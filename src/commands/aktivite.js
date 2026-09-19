'use strict';

const { setActivity, TYPE_LIST } = require('../utils/presence');

module.exports = {
  name: 'aktivite',
  aliases: ['activity', 'oyna', 'izle', 'dinle', 'ozeldurum'],
  description: 'Profil aktiviteni ayarlar (oynuyor/izliyor/dinliyor/özel durum).',
  usage: 'aktivite <oyna|izle|dinle|yayın|özel|temizle> <metin>',
  category: 'profil',
  cooldown: 3000,

  async run({ client, message, args, config, invokedAs }) {
    // ".oyna Minecraft" gibi takma adla çağrıldıysa tipi takma addan al
    const aliasTypes = { oyna: 'oyna', izle: 'izle', dinle: 'dinle', ozeldurum: 'ozel' };
    let type;
    let text;

    if (invokedAs && aliasTypes[invokedAs]) {
      type = aliasTypes[invokedAs];
      text = args.join(' ');
    } else {
      type = args.shift();
      text = args.join(' ');
    }

    if (!type) {
      return message.channel.send(
        `\`❌ Kullanım: ${config.prefix}aktivite <${TYPE_LIST}> <metin>\``,
      );
    }

    // Özel durumda ilk kelime emoji olabilir (örn. ".aktivite özel 😎 takılıyorum")
    let emoji;
    if (['ozel', 'özel', 'custom', 'cs'].includes(type.toLowerCase())) {
      const parts = text.split(/\s+/);
      if (parts[0] && /\p{Emoji}/u.test(parts[0]) && parts.length > 1) {
        emoji = parts.shift();
        text = parts.join(' ');
      }
    }

    const res = setActivity(client, type, text, { emoji });

    if (res.cleared) return message.channel.send('`✅ Aktivite temizlendi.`');
    if (!res.ok) return message.channel.send(`\`❌ ${res.error}\``);
    return message.channel.send(`\`✅ Aktivite ayarlandı: ${res.type}${text ? ' - ' + text : ''}\``);
  },
};
