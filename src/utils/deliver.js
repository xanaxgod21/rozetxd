'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');
const logger = require('./logger');
const webhook = require('./webhook');

/**
 * Sunucu adından geçerli bir Discord kanal adı üretir.
 * Örn: "XX Sunucusu" + "-rozetler" -> "xx-sunucusu-rozetler"
 */
function sanitizeChannelName(name, suffix = '-rozetler') {
  const base =
    String(name || 'sunucu')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '') // Discord kanal adı için güvenli karakterler
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100 - suffix.length) || 'sunucu';
  return `${base}${suffix}`;
}

/**
 * Kontrol sunucusunda (outputGuildId) aynı isimde kanal varsa onu döner,
 * yoksa yeni bir metin kanalı açar. Yetki yoksa null.
 */
async function createOrFindChannel(client, guildName) {
  const { rareScan } = config;

  const outGuild = client.guilds.cache.get(rareScan.outputGuildId);
  if (!outGuild) {
    logger.warn(
      `[nadir] outputGuildId (${rareScan.outputGuildId}) bulunamadı. ` +
        'Hesabın üye olduğu, kanal açma yetkin olan bir sunucunun ID\'si olmalı.',
    );
    return null;
  }

  // Rol/izin yeni verilmiş olabilir; taze üye bilgisi çek (önbellek bayat olmasın)
  await outGuild.members.fetchMe?.().catch(() => null);

  const wanted = sanitizeChannelName(guildName, rareScan.channelSuffix ?? '-rozetler');

  const existing = outGuild.channels.cache.find(
    (c) => c.name === wanted && (c.type === 'GUILD_TEXT' || c.type === 0),
  );
  if (existing) return existing;

  // Önce kategori altında dene; kategori engelliyorsa kategorisiz (kök) dene
  const attempts = rareScan.outputCategoryId
    ? [rareScan.outputCategoryId, undefined]
    : [undefined];

  let lastErr;
  for (const parent of attempts) {
    try {
      const channel = await outGuild.channels.create(wanted, {
        type: 'GUILD_TEXT',
        parent: parent || undefined,
        reason: 'rozetxd nadir rozet listesi',
      });
      logger.info(
        `[nadir] Kanal açıldı: #${channel.name} (${outGuild.name})${parent ? ' [kategori altında]' : ' [kök]'}`,
      );
      return channel;
    } catch (err) {
      lastErr = err;
      if (parent) {
        logger.warn(`[nadir] Kategori altında açılamadı (${err.message}), kategorisiz deneniyor...`);
      }
    }
  }

  logger.warn(`[nadir] Kanal açılamadı: ${lastErr?.message} — kylliie__ hesabının "Kanalları Yönet" yetkisi var mı?`);
  return null;
}

/**
 * Tarama raporunu sırayla dener: (1) outputGuildId'de <isim>-rozetler kanalı,
 * (2) sabit outputChannelId, (3) webhook. Hiçbiri yoksa uyarır.
 * @returns {Promise<boolean>} gönderildi mi
 */
async function deliverReport(client, guildName, report) {
  const { rareScan } = config;

  // 1) Kontrol sunucusunda sunucuya özel kanal aç/bul
  if (rareScan.outputGuildId) {
    const channel = await createOrFindChannel(client, guildName);
    if (channel?.send) {
      const ok = await channel
        .send(report)
        .then(() => true)
        .catch((err) => {
          logger.warn(`[nadir] Kanala gönderilemedi: ${err.message}`);
          return false;
        });
      if (ok) {
        logger.info(`[nadir] Sonuç kanala gönderildi: #${channel.name}`);
        return true;
      }
    }
  } else {
    logger.info('[nadir] outputGuildId ayarlı değil — kanal açma atlanıyor, webhook/dosya denenecek.');
  }

  // 2) Sabit çıktı kanalı
  if (rareScan.outputChannelId) {
    const ch = client.channels.cache.get(rareScan.outputChannelId);
    if (ch?.send) {
      const ok = await ch.send(report).then(() => true).catch(() => false);
      if (ok) {
        logger.info('[nadir] Sonuç sabit çıktı kanalına gönderildi.');
        return true;
      }
    }
  }

  // 3) Webhook (embed + .txt)
  if (webhook.enabled) {
    const ok = await webhook.sendReport(report);
    if (ok) {
      logger.info('[nadir] Sonuç webhook\'a gönderildi.');
      return true;
    }
  }

  // 4) Hiçbiri olmadı: GARANTİ çıktı — listeyi VDS'te yerel dosyaya kaydet
  try {
    const file = report.files?.[0];
    if (file?.attachment) {
      const dir = path.join(__dirname, '..', '..', 'taramalar');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, file.name ?? `tarama-${Date.now()}.txt`);
      fs.writeFileSync(filePath, file.attachment);
      logger.warn(
        `[nadir] Discord'a gönderilemedi (kanal/webhook ayarlı değil ya da yetki yok). ` +
          `Liste yerel dosyaya kaydedildi: ${filePath}`,
      );
      return true;
    }
  } catch (err) {
    logger.error(`[nadir] Yerel dosyaya da kaydedilemedi: ${err.message}`);
  }

  logger.warn(
    '[nadir] Sonuç hiçbir yere gönderilemedi. config.json > rareScan.outputGuildId ' +
      '(kanal açma yetkin olan sunucu) ya da outputChannelId / .env WEBHOOK_URL ayarla.',
  );
  return false;
}

module.exports = { deliverReport, sanitizeChannelName, createOrFindChannel };
