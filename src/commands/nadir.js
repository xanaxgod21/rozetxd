'use strict';

const { scanInvite, buildReport, extractInviteCodes } = require('../utils/rareScan');

module.exports = {
  name: 'nadir',
  aliases: ['rare', 'rozet'],
  description: 'Verilen davetteki sunucuya girip nadir rozetli üyeleri listeler.',
  usage: 'nadir <davet linki>',
  category: 'araçlar',
  cooldown: 30000,

  async run({ client, message, args, config, logger, webhook }) {
    const input = args.join(' ');
    const [code] = extractInviteCodes(input);

    if (!code && !input.trim()) {
      return message.channel.send(
        `\`❌ Kullanım: ${config.prefix}nadir <davet linki>\``,
      );
    }

    const status = await message.channel.send('`⏳ Başlatılıyor...`');
    const onStatus = (msg) => status.edit(`\`⏳ ${msg}\``).catch(() => null);

    try {
      const result = await scanInvite(client, input || code, onStatus);
      const report = buildReport(result);

      await status.edit(`\`✅ Tarama bitti: ${result.rareMembers.length} nadir rozetli üye\``).catch(() => null);
      await message.channel.send(report);

      // İstenmişse sunucudan çık
      if (config.rareScan.leaveAfterScan && !result.alreadyJoined) {
        await result.guild.leave().catch(() => null);
        logger.info(`[nadir] "${result.guildName}" sunucusundan çıkıldı (leaveAfterScan).`);
      }

      if (config.webhook.commands) {
        await webhook.embed({
          title: '🏷️ Nadir rozet taraması',
          color: 0xf1c40f,
          fields: [
            { name: 'Sunucu', value: result.guildName, inline: true },
            { name: 'Taranan', value: String(result.total), inline: true },
            { name: 'Nadir rozetli', value: String(result.rareMembers.length), inline: true },
          ],
        });
      }
    } catch (err) {
      logger.error('[nadir] Tarama hatası:', err);
      await status.edit(`\`❌ ${err.message.slice(0, 300)}\``).catch(() => null);
      if (config.webhook.errors) await webhook.error('Nadir rozet taraması', err);
    }
  },
};
