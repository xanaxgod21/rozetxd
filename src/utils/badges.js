'use strict';

/**
 * Discord rozetleri (UserFlags) için okunabilir Türkçe etiketler ve emojiler.
 * "Nadir" hangi rozetler sayılır, config.rareScan.rareFlags belirler.
 */
const BADGE_LABELS = {
  DISCORD_EMPLOYEE: { emoji: '🛡️', label: 'Discord Personeli' },
  PARTNERED_SERVER_OWNER: { emoji: '🤝', label: 'Partner Sunucu Sahibi' },
  HYPESQUAD_EVENTS: { emoji: '🎉', label: 'HypeSquad Events' },
  BUGHUNTER_LEVEL_1: { emoji: '🐛', label: 'Bug Hunter' },
  BUGHUNTER_LEVEL_2: { emoji: '🏅', label: 'Bug Hunter (Altın)' },
  HOUSE_BRAVERY: { emoji: '🏠', label: 'HypeSquad Bravery' },
  HOUSE_BRILLIANCE: { emoji: '🏠', label: 'HypeSquad Brilliance' },
  HOUSE_BALANCE: { emoji: '🏠', label: 'HypeSquad Balance' },
  EARLY_SUPPORTER: { emoji: '💎', label: 'Erken Destekçi' },
  EARLY_VERIFIED_BOT_DEVELOPER: { emoji: '⚙️', label: 'Erken Doğrulanmış Bot Geliştirici' },
  DISCORD_CERTIFIED_MODERATOR: { emoji: '🎖️', label: 'Moderatör Programı Mezunu' },
  ACTIVE_DEVELOPER: { emoji: '🧰', label: 'Aktif Geliştirici' },
  VERIFIED_BOT: { emoji: '✅', label: 'Doğrulanmış Bot' },
};

/** Flag adına göre etiket döner; tanımsızsa flag adını olduğu gibi verir. */
function labelFor(flag) {
  return BADGE_LABELS[flag] ?? { emoji: '🏷️', label: flag };
}

/**
 * Bir üyenin, verilen "nadir" flag listesiyle kesişen rozetlerini döner.
 * @param {import('discord.js-selfbot-v13').GuildMember} member
 * @param {string[]} rareFlags
 * @returns {string[]} eşleşen flag adları
 */
function getRareBadges(member, rareFlags) {
  const flags = member.user?.flags;
  if (!flags) return [];

  let owned;
  try {
    owned = flags.toArray(); // ['EARLY_SUPPORTER', ...]
  } catch {
    return [];
  }

  const rareSet = new Set(rareFlags);
  return owned.filter((flag) => rareSet.has(flag));
}

module.exports = { BADGE_LABELS, labelFor, getRareBadges };
