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

    // Rol yeni verilmiş olabilir -> TAZE üye çek (önbellek bayat olmasın)
    let me = null;
    try {
      me = await g.members.fetchMe();
    } catch {
      me = g.members?.me ?? g.me ?? (client.user ? g.members?.cache?.get(client.user.id) : null);
    }
    const isAdmin = me?.permissions?.has?.('ADMINISTRATOR');
    const canManage = me?.permissions?.has?.('MANAGE_CHANNELS');
    out.push(`Yönetici: ${isAdmin === true ? 'VAR' : isAdmin === false ? 'YOK' : '?'} | Kanalları Yönet: ${canManage === true ? 'VAR' : canManage === false ? 'YOK' : '?'}`);

    // Kanal açmayı dene: önce kategori altında, olmazsa kategorisiz
    const attempts = outputCategoryId ? [outputCategoryId, undefined] : [undefined];
    let done = false;
    let lastErr;
    for (const parent of attempts) {
      try {
        const ch = await g.channels.create('rozetxd-test', {
          type: 'GUILD_TEXT',
          parent: parent || undefined,
          reason: 'rozetxd kanal açma testi',
        });
        out.push(`SONUÇ: ✅ KANAL AÇILDI -> #${ch.name}${parent ? ' (kategori altında)' : ' (kök)'}`);
        out.push('Test başarılı. "rozetxd-test" kanalını silebilirsin.');
        done = true;
        break;
      } catch (err) {
        lastErr = err;
        if (parent) out.push(`Kategori altında olmadı (${err.message}) -> kategorisiz deneniyor...`);
      }
    }
    if (!done) {
      out.push(`SONUÇ: ❌ Kanal AÇILAMADI -> ${lastErr?.message}`);
      out.push('Sebep: kylliie__ hesabının bu sunucuda "Kanalları Yönet" yetkisi yok.');
      out.push('Rolü KYLLIIE__ hesabına verdiğinden ve botu restart ettiğinden emin ol.');
    }

    return message.channel.send('```\n' + out.join('\n') + '\n```');
  },
};
