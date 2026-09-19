'use strict';

const { resolveStatus, STATUS_LIST } = require('../utils/presence');

module.exports = {
  name: 'durum',
  aliases: ['status'],
  description: 'Hesabın çevrimiçi durumunu değiştirir.',
  usage: 'durum <online|idle|dnd|invisible>',
  category: 'profil',
  cooldown: 3000,

  async run({ client, message, args, config }) {
    const status = resolveStatus(args[0]);

    if (!status) {
      return message.channel.send(`\`❌ Kullanım: ${config.prefix}durum <${STATUS_LIST}>\``);
    }

    try {
      client.user.setStatus(status);
      return message.channel.send(`\`✅ Durum: ${status}\``);
    } catch (err) {
      return message.channel.send(`\`❌ Ayarlanamadı: ${err.message.slice(0, 150)}\``);
    }
  },
};
