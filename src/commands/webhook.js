'use strict';

module.exports = {
  name: 'webhook',
  aliases: ['wh'],
  description: 'Webhook bağlantısını test eder veya webhook üzerinden mesaj gönderir.',
  usage: 'webhook <test|gonder <mesaj>>',
  category: 'araçlar',

  async run({ message, args, webhook, config }) {
    if (!webhook.enabled) {
      return message.channel.send(
        '`❌ Webhook tanımlı değil. .env dosyasına WEBHOOK_URL ekle.`',
      );
    }

    const sub = args.shift()?.toLowerCase() ?? 'test';

    if (sub === 'test') {
      const started = Date.now();
      const ok = await webhook.embed({
        title: '✅ Webhook testi',
        description: 'Bağlantı çalışıyor.',
        color: 0x57f287,
        footer: 'rozetxd',
      });

      return message.channel.send(
        ok
          ? `\`✅ Webhook çalışıyor (${Date.now() - started}ms)\``
          : '`❌ Webhook gönderilemedi. URL doğru mu kontrol et.`',
      );
    }

    if (sub === 'gonder' || sub === 'gönder' || sub === 'send') {
      const content = args.join(' ');
      if (!content) {
        return message.channel.send(`\`❌ Kullanım: ${config.prefix}webhook gonder <mesaj>\``);
      }

      const ok = await webhook.text(content);
      return message.channel.send(ok ? '`✅ Gönderildi.`' : '`❌ Gönderilemedi.`');
    }

    return message.channel.send(
      `\`❌ Kullanım: ${config.prefix}webhook <test|gonder <mesaj>>\``,
    );
  },
};
