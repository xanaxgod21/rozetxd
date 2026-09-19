'use strict';

const { extractInviteCodes, ensureSessionId } = require('../utils/rareScan');

module.exports = {
  name: 'gir',
  aliases: ['join', 'katil', 'katıl'],
  description: 'Verilen davetteki sunucuya girer ve kalır (tarama yapmaz).',
  usage: 'gir <davet linki>',
  category: 'araçlar',
  cooldown: 5000,
  // Herkes tetikleyebilir; token'ı girilen hesap (self-bot) sunucuya girer.
  everyone: true,

  async run({ client, message, args, config, logger, webhook }) {
    const input = args.join(' ');
    const [code] = extractInviteCodes(input);
    const inviteCode = code ?? input.trim();

    if (!inviteCode) {
      return message.channel.send(
        `\`❌ Kullanım: ${config.prefix}gir <davet linki>\``,
      );
    }

    const status = await message.channel.send('`⏳ Sunucuya giriliyor...`');

    try {
      // Önce önizleme: sunucu adını görelim
      const preview = await client.fetchInvite(inviteCode).catch((err) => {
        throw new Error(`Davet geçersiz veya süresi dolmuş: ${err.message}`);
      });
      const guildName = preview.guild?.name ?? 'bilinmeyen sunucu';

      const alreadyIn = Boolean(preview.guild?.id && client.guilds.cache.has(preview.guild.id));
      if (alreadyIn) {
        return status.edit(`\`ℹ️ "${guildName}" sunucusunda zaten varsın.\``);
      }

      ensureSessionId(client);
      const guild = await client.acceptInvite(inviteCode).catch((err) => {
        throw new Error(`Sunucuya girilemedi: ${err.message}`);
      });

      const name = guild?.name ?? guildName;
      logger.info(`[gir] "${name}" sunucusuna girildi.`);
      await status.edit(`\`✅ "${name}" sunucusuna girildi.\``);

      if (config.webhook.commands) {
        await webhook.embed({
          title: '➡️ Sunucuya girildi',
          color: 0x57f287,
          fields: [
            { name: 'Sunucu', value: name, inline: true },
            { name: 'ID', value: guild?.id ?? '—', inline: true },
          ],
        });
      }
    } catch (err) {
      logger.error('[gir] Hata:', err);
      await status.edit(`\`❌ ${err.message.slice(0, 300)}\``).catch(() => null);
      if (config.webhook.errors) await webhook.error('Sunucuya girme', err);
    }
  },
};
