'use strict';

const { resolveGuild, scanGuild, buildReport } = require('../utils/rareScan');

module.exports = {
  name: 'nadir',
  aliases: ['rare', 'rozet'],
  description: 'Hesabın üye olduğu bir sunucudaki nadir rozetli üyeleri listeler.',
  usage: 'nadir [sunucu ID veya adı]',
  category: 'araçlar',
  cooldown: 10000,

  async run({ client, message, args, config, logger, webhook }) {
    const input = args.join(' ');
    const guild = resolveGuild(client, input, message);

    if (!guild) {
      return message.channel.send(
        '`❌ Sunucu bulunamadı. Bu komutu taramak istediğin sunucuda çalıştır, ' +
          `ya da ${config.prefix}nadir <sunucu ID> yaz (hesabın üye olduğu bir sunucu).\``,
      );
    }

    const status = await message.channel.send('`⏳ Başlatılıyor...`');
    const onStatus = (msg) => status.edit(`\`⏳ ${msg}\``).catch(() => null);

    try {
      const result = await scanGuild(client, guild, onStatus);
      const report = buildReport(result);

      await status.edit(`\`✅ Tarama bitti: ${result.rareMembers.length} nadir rozetli üye\``).catch(() => null);
      await message.channel.send(report);

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
