'use strict';

module.exports = {
  name: 'ready',
  once: true,

  async run(client) {
    const { logger, webhook, config } = client;

    // acceptInvite'ın session_id'yi bulabilmesi için shard'daki değeri client'a yaz
    client.sessionId = client.ws?.shards?.first()?.sessionId ?? client.sessionId ?? null;

    logger.info(`Giriş yapıldı: ${client.user.tag} (${client.user.id})`);
    logger.info(`Ön ek: "${config.prefix}" | Komut: ${client.commands.size} | Sunucu: ${client.guilds.cache.size}`);

    // OWNER_IDS boşsa sadece kendi hesabın komut kullanabilsin
    if (!config.ownerIds.length) {
      config.ownerIds.push(client.user.id);
      logger.debug('OWNER_IDS boş, sadece kendi hesabın yetkili.');
    }

    // config.json'da presence tanımlıysa uygula
    if (config.presence?.status) {
      try {
        client.user.setStatus(config.presence.status);
        logger.debug(`Durum ayarlandı: ${config.presence.status}`);
      } catch (err) {
        logger.warn('Durum ayarlanamadı:', err.message);
      }
    }

    if (config.webhook.ready) {
      await webhook.embed({
        title: '🟢 Bot aktif',
        color: 0x57f287,
        fields: [
          { name: 'Hesap', value: client.user.tag, inline: true },
          { name: 'Ön ek', value: `\`${config.prefix}\``, inline: true },
          { name: 'Komut', value: String(client.commands.size), inline: true },
          { name: 'Sunucu', value: String(client.guilds.cache.size), inline: true },
        ],
        footer: 'rozetxd',
      });
    }
  },
};
