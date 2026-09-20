'use strict';

const { MessageEmbed, MessageAttachment } = require('discord.js-selfbot-v13');
const { config } = require('../config');
const { labelFor, getRareBadges } = require('./badges');
const logger = require('./logger');

/**
 * Girdiye göre, hesabın ZATEN ÜYE OLDUĞU bir sunucuyu bulur.
 * - input boşsa: komutun yazıldığı sunucu (message.guild)
 * - input bir ID ise: o ID'li sunucu
 * - input bir isimse: adı eşleşen ilk sunucu
 * Hiçbiri değilse null (sunucuya KATILMAYIZ; sadece üye olunanlar taranır).
 */
function resolveGuild(client, input, message) {
  const query = (input ?? '').trim();

  if (!query) return message?.guild ?? null;

  const byId = client.guilds.cache.get(query);
  if (byId) return byId;

  const lower = query.toLowerCase();
  return client.guilds.cache.find((g) => g.name.toLowerCase().includes(lower)) ?? null;
}

/**
 * Sunucunun TÜM üyelerini gateway üzerinden (chunk chunk) mümkün olan en hızlı
 * şekilde çeker.
 *
 * En hızlı + eksiksiz yol tek bir REQUEST_GUILD_MEMBERS isteğidir:
 *   query: ''  -> herkes (isim filtresi yok)
 *   limit: 0   -> sınır yok, bütün üyeler
 *   withPresences: false -> presence verisi çekilmez; üye başına çok daha az
 *     veri gelir, yani belirgin şekilde daha hızlı tamamlanır (asıl hız kazancı).
 *
 * Not: Buradan sonrası Discord'un gateway'ine bağlıdır — üyeler 1000'erlik
 * parçalar halinde Discord ne kadar hızlı yollarsa o hızda gelir. Client
 * tarafında yapay bir bekleme/throttle yoktur, dolayısıyla bu zaten en hızlı
 * tam-liste yöntemidir.
 *
 * Süre dolar ve tüm liste gelmezse (büyük sunucularda user hesabıyla sık olur)
 * HATA VERMEZ: o ana kadar gelen üyeler guild.members.cache'de birikmiştir,
 * onlarla (kısmi) devam eder. Böylece kalabalık sunucuda bile en azından
 * gelen üyeler arasından nadir rozetliler bulunup atılır.
 * @returns {Promise<{members, timedOut:boolean}>}
 */
async function fetchAllMembers(guild, timeoutMs) {
  try {
    const members = await guild.members.fetch({
      query: '',
      limit: 0,
      withPresences: false,
      time: timeoutMs,
    });
    return { members, timedOut: false };
  } catch (err) {
    const partial = guild.members.cache;
    logger.warn(
      `[nadir] Tüm üyeler ${Math.round(timeoutMs / 1000)}sn'de gelmedi (büyük sunucu). ` +
        `Eldeki ${partial.size} üyeyle devam ediliyor (kısmi liste). [${err.message}]`,
    );
    return { members: partial, timedOut: true };
  }
}

/**
 * Hesabın ZATEN ÜYE OLDUĞU bir sunucuyu tarar, nadir rozetlileri süzer.
 * Sunucuya KATILMAZ (acceptInvite yok) — hesabı yakan tetikleyici buydu.
 *
 * @param {import('discord.js-selfbot-v13').Client} client
 * @param {import('discord.js-selfbot-v13').Guild} guild üye olunan sunucu
 * @param {(msg: string) => void} [onStatus] ara durum bildirimi
 * @returns {Promise<{guild, guildName:string, total:number, timedOut:boolean, rareMembers:Array}>}
 */
async function scanGuild(client, guild, onStatus = () => {}) {
  const { rareScan } = config;

  if (!guild?.members) throw new Error('Geçerli bir sunucu bulunamadı.');

  const guildName = guild.name ?? 'bilinmeyen sunucu';

  onStatus(`"${guildName}" taranıyor — üyeler çekiliyor (kalabalık sunucuda uzun sürebilir)...`);
  const { members, timedOut } = await fetchAllMembers(guild, rareScan.fetchTimeoutMs);

  const rareMembers = [];
  for (const member of members.values()) {
    if (member.user?.bot) continue;
    const badges = getRareBadges(member, rareScan.rareFlags);
    if (badges.length) {
      rareMembers.push({
        id: member.id,
        tag: member.user.tag ?? member.user.username,
        badges,
      });
    }
  }

  // Çok rozetliler önce, sonra isme göre
  rareMembers.sort((a, b) => b.badges.length - a.badges.length || a.tag.localeCompare(b.tag));

  logger.info(`[nadir] "${guildName}": ${members.size} üyeden ${rareMembers.length} nadir rozetli bulundu.`);

  return { guild, guildName, total: members.size, timedOut, rareMembers };
}

/**
 * Tarama sonucundan Discord'a gönderilebilir embed + (uzunsa) .txt eki üretir.
 * @returns {{ embeds: MessageEmbed[], files?: MessageAttachment[] }}
 */
function buildReport(result) {
  const { guildName, total, timedOut, rareMembers } = result;

  // Rozet başına sayım
  const counts = {};
  for (const m of rareMembers) {
    for (const flag of m.badges) counts[flag] = (counts[flag] ?? 0) + 1;
  }

  const embed = new MessageEmbed()
    .setColor(rareMembers.length ? 0xf1c40f : 0x99aab5)
    .setTitle(`🏷️ Nadir Rozetli Üyeler — ${guildName}`.slice(0, 256))
    .setTimestamp();

  const breakdown = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([flag, n]) => {
      const { emoji, label } = labelFor(flag);
      return `${emoji} ${label}: **${n}**`;
    })
    .join('\n');

  embed.setDescription(
    [
      `Taranan üye: **${total}**${timedOut ? ' (kısmi — zaman aşımı)' : ''}`,
      `Nadir rozetli: **${rareMembers.length}**`,
      breakdown ? `\n${breakdown}` : '',
    ].join('\n'),
  );

  if (!rareMembers.length) {
    embed.setDescription(`${embed.description}\n\nNadir rozetli üye bulunamadı.`);
    return { embeds: [embed] };
  }

  // İlk 25'i embed alanı olarak; tamamı .txt ekinde
  const preview = rareMembers.slice(0, 25).map((m) => {
    const icons = m.badges.map((f) => labelFor(f).emoji).join('');
    return `${icons} ${m.tag}`;
  });

  const previewText = preview.join('\n');
  if (previewText.length <= 1024) {
    embed.addField(`İlk ${preview.length} kişi`, previewText || '—');
  }

  // Tam liste dosyası
  const lines = rareMembers.map((m) => {
    const labels = m.badges.map((f) => labelFor(f).label).join(', ');
    return `${m.tag} (${m.id}) — ${labels}`;
  });
  const fileContent =
    `Sunucu: ${guildName}\nTaranan üye: ${total}${timedOut ? ' (kısmi)' : ''}\n` +
    `Nadir rozetli: ${rareMembers.length}\n` +
    `Tarih: ${new Date().toLocaleString('tr-TR')}\n` +
    `${'-'.repeat(40)}\n` +
    lines.join('\n');

  const attachment = new MessageAttachment(
    Buffer.from(fileContent, 'utf8'),
    `nadir-rozet-${Date.now()}.txt`,
  );

  return { embeds: [embed], files: [attachment] };
}

module.exports = { resolveGuild, scanGuild, buildReport };
