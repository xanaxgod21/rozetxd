'use strict';

const { loadCommands } = require('../handlers/commands');

module.exports = {
  name: 'reload',
  aliases: ['yenile', 'rl'],
  description: 'Komutları botu kapatmadan yeniden yükler.',
  usage: 'reload',
  category: 'araçlar',

  async run({ client, message }) {
    const before = client.commands.size;
    const loaded = loadCommands(client);

    return message.channel.send(
      `\`✅ Komutlar yenilendi: ${before} → ${loaded}\``,
    );
  },
};
