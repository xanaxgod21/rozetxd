'use strict';

module.exports = {
  name: 'kanaltest',
  aliases: ['channeltest', 'kanal-test'],
  description: 'Kanal açma hedefini/iznini test eder, sonucu bu kanala yazar.',
  usage: 'kanaltest',
  category: 'araçlar',
  cooldown: 5000,

  async run({ client, message, config }) {
    const { outputGuildId, outputCategoryId } = config.rareScan;
    const out = ['== rozetxd kanal açma testi =='];

    out.push(`outputGuildId: ${outputGuildId || '(BOŞ! config.json/.env ayarla)'}`);

    if (!outputGuildId) {
      out.push('SONUÇ: ❌ outputGuildId boş — kanal açamaz.');
      return message.channel.send('```\n' + out.join('\n') + '\n```');
    }

    const g = client.guilds.cache.get(outputGuildId);
    out.push(`Sunucu bulundu: ${g ? `EVET -> "${g.name}"` : 'HAYIR (hesap bu sunucuda değil ya da ID yanlış)'}`);

    if (!g) {
      out.push('SONUÇ: ❌ Bu ID\'li sunucu bulunamadı.');
      out.push('Not: outputGuildId TARANAN sunucu değil, kanalın açılacağı KENDİ sunucun olmalı.');
      return message.channel.send('```\n' + out.join('\n') + '\n```');
    }

    // Yetki kontrolü (mümkünse)
    try {
      const me = g.members?.me ?? g.me ?? (client.user ? g.members?.cache?.get(client.user.id) : null);
      const canManage = me?.permissions?.has?.('MANAGE_CHANNELS');
      out.push(`Kanalları Yönet yetkisi: ${canManage === true ? 'VAR' : canManage === false ? 'YOK' : 'bilinmiyor'}`);
    } catch {
      out.push('Kanalları Yönet yetkisi: kontrol edilemedi');
    }

    // Gerçekten kanal açmayı dene
    try {
      const ch = await g.channels.create('rozetxd-test', {
        type: 'GUILD_TEXT',
        parent: outputCategoryId || undefined,
        reason: 'rozetxd kanal açma testi',
      });
      out.push(`SONUÇ: ✅ KANAL AÇILDI -> #${ch.name} (${ch.id})`);
      out.push('Test başarılı. Bu "rozetxd-test" kanalını silebilirsin.');
    } catch (err) {
      out.push(`SONUÇ: ❌ Kanal AÇILAMADI -> ${err.message}`);
      out.push('Genelde sebep: hesabın o sunucuda "Kanalları Yönet" yetkisi yok.');
    }

    return message.channel.send('```\n' + out.join('\n') + '\n```');
  },
};
