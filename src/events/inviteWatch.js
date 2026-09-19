'use strict';

const { scanInvite, buildReport, extractInviteCodes } = require('../utils/rareScan');

// Aynı anda tek tarama + kanal bazlı bekleme süresi
let scanning = false;
let lastScanAt = 0;

module.exports = {
  name: 'messageCreate',

  async run(client, message) {
    const { config, logger, webhook } = client;
    const { watchChannelId, rareScan } = config;

    // Özellik kapalıysa veya izlenen kanal ayarlı değilse çık
    if (!rareScan.autoJoinFromWatchChannel || !watchChannelId) return;
    if (message.channel.id !== watchChannelId) return;

    // Sadece yetkili hesap (varsayılan: kendi hesabın) tetikleyebilir
    if (!config.ownerIds.includes(message.author.id)) return;

    const codes = extractInviteCodes(message.content);
    if (!codes.length) return;

    // Komutla çakışmasın: mesaj prefix ile başlıyorsa nadir komutu ilgilenir
    if (message.content.startsWith(config.prefix)) return;

    if (scanning) {
      await message.channel.send('`⏳ Zaten bir tarama sürüyor, bitince tekrar dene.`').catch(() => null);
      return;
    }

    const now = Date.now();
    if (now - lastScanAt < rareScan.cooldownMs) {
      const wait = ((rareScan.cooldownMs - (now - lastScanAt)) / 1000).toFixed(0);
      await message.channel.send(`\`⏳ ${wait}sn sonra tekrar dene.\``).catch(() => null);
      return;
    }

    scanning = true;
    lastScanAt = now;

    const status = await message.channel.send('`⏳ Davet algılandı, başlatılıyor...`').catch(() => null);
    const onStatus = (msg) => status?.edit(`\`⏳ ${msg}\``).catch(() => null);

    try {
      // Mesajda birden fazla davet olabilir; ilkini tarıyoruz
      const result = await scanInvite(client, codes[0], onStatus);
      const report = buildReport(result);

      await status?.edit(`\`✅ Tarama bitti: ${result.rareMembers.length} nadir rozetli üye\``).catch(() => null);
      await message.channel.send(report);

      if (rareScan.leaveAfterScan && !result.alreadyJoined) {
        await result.guild.leave().catch(() => null);
        logger.info(`[nadir] "${result.guildName}" sunucusundan çıkıldı (leaveAfterScan).`);
      }

      if (config.webhook.commands) {
        await webhook.embed({
          title: '🏷️ Nadir rozet taraması (otomatik)',
          color: 0xf1c40f,
          fields: [
            { name: 'Sunucu', value: result.guildName, inline: true },
            { name: 'Taranan', value: String(result.total), inline: true },
            { name: 'Nadir rozetli', value: String(result.rareMembers.length), inline: true },
          ],
        });
      }
    } catch (err) {
      logger.error('[nadir/watch] Tarama hatası:', err);
      await status?.edit(`\`❌ ${err.message.slice(0, 300)}\``).catch(() => null);
      if (config.webhook.errors) await webhook.error('Nadir rozet taraması (otomatik)', err);
    } finally {
      scanning = false;
    }
  },
};
