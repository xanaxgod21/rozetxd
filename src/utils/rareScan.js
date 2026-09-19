'use strict';

const { MessageEmbed, MessageAttachment } = require('discord.js-selfbot-v13');
const { config } = require('../config');
const { labelFor, getRareBadges } = require('./badges');
const logger = require('./logger');

// discord.gg/kod, discord.com/invite/kod, discordapp.com/invite/kod
const INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg)\/([\w-]+)/gi;

/** Metindeki tüm davet kodlarını (tekilleştirilmiş) çıkarır. */
function extractInviteCodes(text) {
  if (!text) return [];
  const codes = new Set();
  let match;
  INVITE_REGEX.lastIndex = 0;
  while ((match = INVITE_REGEX.exec(text)) !== null) {
    codes.add(match[1]);
  }
  return [...codes];
}

/** Üye çekmeyi zaman aşımıyla sarar; süre dolarsa eldeki cache ile devam eder. */
async function fetchMembersWithTimeout(guild, timeoutMs) {
  try {
    const members = await Promise.race([
      guild.members.fetch({ withPresences: false }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ]);
    return { members, timedOut: false };
  } catch (err) {
    if (err.message === 'timeout') {
      logger.warn(`[nadir] Üye çekme ${timeoutMs}ms'de tamamlanamadı, eldeki ${guild.members.cache.size} üye kullanılıyor.`);
      return { members: guild.members.cache, timedOut: true };
    }
    throw err;
  }
}

/**
 * Bir daveti kabul edip sunucuya girer, üyeleri çeker ve nadir rozetlileri süzer.
 *
 * @param {import('discord.js-selfbot-v13').Client} client
 * @param {string} input davet linki veya kodu
 * @param {(msg: string) => void} [onStatus] ara durum bildirimi
 * @returns {Promise<{guild, alreadyJoined:boolean, total:number, timedOut:boolean, rareMembers:Array}>}
 */
async function scanInvite(client, input, onStatus = () => {}) {
  const { rareScan } = config;

  const [code] = extractInviteCodes(input);
  const inviteCode = code ?? input.trim();
  if (!inviteCode) throw new Error('Geçerli bir davet linki/kodu bulunamadı.');

  // Önce önizleme: üye sayısını görüp katılmadan sınırı kontrol edelim
  onStatus('Davet inceleniyor...');
  const preview = await client.fetchInvite(inviteCode).catch((err) => {
    throw new Error(`Davet geçersiz veya süresi dolmuş: ${err.message}`);
  });

  const guildName = preview.guild?.name ?? 'bilinmeyen sunucu';
  const approx = preview.memberCount ?? preview.guild?.approximateMemberCount ?? 0;

  if (approx && approx > rareScan.maxMembers) {
    throw new Error(
      `"${guildName}" çok kalabalık (~${approx} üye, sınır ${rareScan.maxMembers}). ` +
        'config.json > rareScan.maxMembers ile artırabilirsin.',
    );
  }

  const alreadyJoined = Boolean(preview.guild?.id && client.guilds.cache.has(preview.guild.id));

  onStatus(alreadyJoined ? `"${guildName}" zaten katılımda, taranıyor...` : `"${guildName}" sunucusuna giriliyor...`);
  const guild = await client.acceptInvite(inviteCode).catch((err) => {
    throw new Error(`Sunucuya girilemedi: ${err.message}`);
  });

  if (!guild?.members) throw new Error('Sunucu nesnesi alınamadı (davet bir kanala mı ait?).');

  onStatus('Üyeler çekiliyor, bu biraz sürebilir...');
  const { members, timedOut } = await fetchMembersWithTimeout(guild, rareScan.fetchTimeoutMs);

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

  return { guild, guildName, alreadyJoined, total: members.size, timedOut, rareMembers };
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

module.exports = { extractInviteCodes, scanInvite, buildReport };
