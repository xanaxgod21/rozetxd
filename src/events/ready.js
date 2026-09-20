'use strict';

module.exports = {
  name: 'ready',
  once: true,

  async run(client) {
    const { logger, webhook, config } = client;

    // Otomatik tarama, açılıştaki sunucu yükleme dalgasını taramasın diye
    // "ne zaman hazır olduk" damgası
    client._readyAt = Date.now();

    logger.info(`Giriş yapıldı: ${client.user.tag} (${client.user.id})`);
    logger.info(`Ön ek: "${config.prefix}" | Komut: ${client.commands.size} | Sunucu: ${client.guilds.cache.size}`);

    // OWNER_IDS boşsa sadece kendi hesabın komut kullanabilsin
    if (!config.ownerIds.length) {
      config.ownerIds.push(client.user.id);
      logger.debug('OWNER_IDS boş, sadece kendi hesabın yetkili.');
    }

    // config.json'daki durum + aktiviteyi uygula, döngü açıksa başlat
    const { applyPresenceConfig, startRotation } = require('../utils/presence');
    applyPresenceConfig(client, config.presence);
    startRotation(client, config.presence);

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
