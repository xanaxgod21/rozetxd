'use strict';

module.exports = {
  name: 'help',
  aliases: ['yardim', 'yardım', 'komutlar', 'h'],
  description: 'Komut listesini veya tek bir komutun detayını gösterir.',
  usage: 'help [komut]',
  category: 'genel',

  async run({ client, message, args, config }) {
    const { resolveCommand } = require('../handlers/commands');

    // Tek komut detayı
    if (args[0]) {
      const command = resolveCommand(client, args[0]);

      if (!command) {
        return message.channel.send(`\`❌ "${args[0]}" diye bir komut yok.\``);
      }

      return message.channel.send(
        [
          '```yaml',
          `Komut     : ${command.name}`,
          `Açıklama  : ${command.description ?? '—'}`,
          `Kullanım  : ${config.prefix}${command.usage ?? command.name}`,
          `Takma ad  : ${command.aliases?.join(', ') || '—'}`,
          `Kategori  : ${command.category ?? 'genel'}`,
          '```',
        ].join('\n'),
      );
    }

    // Kategorilere göre tüm komutlar
    const categories = new Map();

    for (const command of client.commands.values()) {
      const category = command.category ?? 'genel';
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(command.name);
    }

    const lines = ['```yaml', `# rozetxd - ${client.commands.size} komut (ön ek: ${config.prefix})`, ''];

    for (const [category, names] of [...categories].sort()) {
      lines.push(`${category}:`);
      lines.push(`  ${names.sort().join(', ')}`);
    }

    lines.push('', `# Detay için: ${config.prefix}help <komut>`, '```');

    return message.channel.send(lines.join('\n'));
  },
};
