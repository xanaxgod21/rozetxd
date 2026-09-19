'use strict';

const { startRotation, stopRotation } = require('../utils/presence');

module.exports = {
  name: 'dongu',
  aliases: ['döngü', 'rotate'],
  description: 'config.json\'daki durum döngüsünü başlatır/durdurur.',
  usage: 'dongu <ac|kapat>',
  category: 'profil',
  cooldown: 3000,

  async run({ client, message, args, config }) {
    const sub = (args[0] ?? '').toLowerCase();

    if (['ac', 'aç', 'on', 'başlat', 'baslat'].includes(sub)) {
      // Geçici olarak açık say ve başlat
      const presence = { ...config.presence, rotate: { ...config.presence?.rotate, enabled: true } };
      const started = startRotation(client, presence);
      return message.channel.send(
        started
          ? '`✅ Durum döngüsü başladı.`'
          : '`❌ config.json > presence.rotate.items boş. Önce öğe ekle.`',
      );
    }

    if (['kapat', 'off', 'durdur', 'stop'].includes(sub)) {
      const stopped = stopRotation(client);
      return message.channel.send(stopped ? '`✅ Durum döngüsü durduruldu.`' : '`ℹ️ Zaten kapalı.`');
    }

    const running = Boolean(client._presenceRotation);
    return message.channel.send(
      `\`Durum döngüsü: ${running ? 'AÇIK' : 'KAPALI'} | Kullanım: ${config.prefix}dongu <ac|kapat>\``,
    );
  },
};
