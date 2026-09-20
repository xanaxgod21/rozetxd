'use strict';

const { MessageEmbed, MessageAttachment } = require('discord.js-selfbot-v13');
const { config } = require('../config');
const { labelFor, getRareBadges } = require('./badges');
const logger = require('./logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Derin tarama için isim ön-ekleri.
// Latin + Türkçe + rakam + Kiril (Rusça) + Arapça harfleri.
// Not: Çince/Japonca/Korece binlerce karakter olduğundan ön-ekle tam
// taranamaz; ama bu dillerdeki kullanıcıların çoğunun latin/rakam takma adı da
// olduğundan büyük kısmı yine yakalanır.
const DEEP_CHARSET = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'çğıioöşü',
  ...'0123456789_.',
  ...'абвгдежзийклмнопрстуфхцчшщъыьэюя', // Kiril
  ...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', // Arapça
];

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
 * DERİN TARAMA: isim ön-ekiyle (a, b, ... aa, ab, ...) tekrar tekrar sorgu atıp
 * mümkün olduğunca çok üye toplar. Büyük sunucuda `query=''`'in getirdiği küçük
 * dilimden çok daha fazlasını bulur. Gelen üyeler guild.members.cache'de birikir.
 *
 * Sınırlar (config.rareScan): deepScanMaxRequests (istek tavanı),
 * deepScanTimeBudgetMs (süre bütçesi), deepScanDelayMs (istekler arası bekleme).
 * Bir ön-ek tavanı (100) doldurursa daha derine iner (o+harf), yoksa durur.
 *
 * @returns {Promise<{members, requests:number, stoppedEarly:boolean}>}
 */
async function fetchMembersDeep(guild, opts, onStatus = () => {}) {
  const { maxRequests, timeBudgetMs, delayMs, perQueryLimit = 100, maxDepth = 3 } = opts;
  const start = Date.now();
  let requests = 0;

  const queue = [...DEEP_CHARSET];

  while (queue.length && requests < maxRequests && Date.now() - start < timeBudgetMs) {
    const prefix = queue.shift();
    try {
      requests += 1;
      const batch = await guild.members.fetch({
        query: prefix,
        limit: perQueryLimit,
        withPresences: false,
        time: 10000,
      });
      // Tavan doldu -> bu ön-ekte daha çok üye var, bir kademe derine in
      if (batch.size >= perQueryLimit && prefix.length < maxDepth) {
        for (const ch of DEEP_CHARSET) queue.push(prefix + ch);
      }
    } catch {
      // bu ön-ekte zaman aşımı/hata -> atla
    }

    if (requests % 10 === 0) {
      onStatus(`Derin tarama: ${guild.members.cache.size} üye, ${requests}/${maxRequests} sorgu...`);
    }
    if (delayMs) await sleep(delayMs);
  }

  return { members: guild.members.cache, requests, stoppedEarly: queue.length > 0 };
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

  let members;
  let timedOut;

  if (rareScan.deepScan) {
    // Büyük sunucularda kapsamı artırmak için isim ön-eki taraması
    onStatus(`"${guildName}" derin taranıyor — üyeler ön-ek ön-ek çekiliyor...`);
    const res = await fetchMembersDeep(
      guild,
      {
        maxRequests: rareScan.deepScanMaxRequests,
        timeBudgetMs: rareScan.deepScanTimeBudgetMs,
        delayMs: rareScan.deepScanDelayMs,
      },
      onStatus,
    );
    members = res.members;
    timedOut = res.stoppedEarly; // tavan/süre dolduysa kısmi say
    logger.info(`[nadir] Derin tarama bitti: ${res.requests} sorgu, ${members.size} üye toplandı.`);
  } else {
    onStatus(`"${guildName}" taranıyor — üyeler çekiliyor...`);
    ({ members, timedOut } = await fetchAllMembers(guild, rareScan.fetchTimeoutMs));
  }

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

  // İlk kişileri embed alanına yaz: rozet + kullanıcı + tıklanır mention.
  // <@id> embed içinde tıklanır olarak görünür ve PING atmaz.
  const previewMembers = rareMembers.slice(0, 20);
  const preview = previewMembers.map((m) => {
    const icons = m.badges.map((f) => labelFor(f).emoji).join('');
    return `${icons} ${m.tag} <@${m.id}>`;
  });

  const previewText = preview.join('\n');
  if (previewText.length <= 1024) {
    embed.addField(`İlk ${previewMembers.length} kişi`, previewText || '—');
  }

  // Tam liste dosyası: kullanıcı, ham ID ve <@id> mention (kopyalayıp pingle)
  const lines = rareMembers.map((m) => {
    const labels = m.badges.map((f) => labelFor(f).label).join(', ');
    return `${m.tag} | ${m.id} | <@${m.id}> — ${labels}`;
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
