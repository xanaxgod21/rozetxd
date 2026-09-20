'use strict';

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

  const wanted = sanitizeChannelName(guildName, rareScan.channelSuffix ?? '-rozetler');

  const existing = outGuild.channels.cache.find(
    (c) => c.name === wanted && (c.type === 'GUILD_TEXT' || c.type === 0),
  );
  if (existing) return existing;

  try {
    const channel = await outGuild.channels.create(wanted, {
      type: 'GUILD_TEXT',
      parent: rareScan.outputCategoryId || undefined,
      reason: 'rozetxd nadir rozet listesi',
    });
    logger.info(`[nadir] Kanal açıldı: #${channel.name} (${outGuild.name})`);
    return channel;
  } catch (err) {
    logger.warn(`[nadir] Kanal açılamadı (kanal açma yetkin var mı?): ${err.message}`);
    return null;
  }
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
      if (ok) return true;
    }
  }

  // 2) Sabit çıktı kanalı
  if (rareScan.outputChannelId) {
    const ch = client.channels.cache.get(rareScan.outputChannelId);
    if (ch?.send) {
      const ok = await ch.send(report).then(() => true).catch(() => false);
      if (ok) return true;
    }
  }

  // 3) Webhook (embed + .txt)
  if (webhook.enabled) {
    const ok = await webhook.sendReport(report);
    if (ok) return true;
  }

  logger.warn(
    '[nadir] Sonuç gönderilecek yer yok. config.json > rareScan.outputGuildId ' +
      '(kanal açma yetkin olan sunucu) ya da outputChannelId / .env WEBHOOK_URL ayarla.',
  );
  return false;
}

module.exports = { deliverReport, sanitizeChannelName, createOrFindChannel };
