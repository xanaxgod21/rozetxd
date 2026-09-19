'use strict';

const { CustomStatus } = require('discord.js-selfbot-v13');
const logger = require('./logger');

// Kullanıcının yazabileceği (TR/EN) -> Discord durumu
const STATUS_MAP = {
  online: 'online', cevrimici: 'online', 'çevrimiçi': 'online', aktif: 'online', acik: 'online',
  idle: 'idle', bosta: 'idle', 'boşta': 'idle', uzakta: 'idle',
  dnd: 'dnd', mesgul: 'dnd', 'meşgul': 'dnd', rahatsiz: 'dnd', 'rahatsız': 'dnd',
  invisible: 'invisible', gizli: 'invisible', gorunmez: 'invisible', 'görünmez': 'invisible', cevrimdisi: 'invisible',
};

// Kullanıcının yazabileceği (TR/EN) -> Discord aktivite tipi
const TYPE_MAP = {
  oyna: 'PLAYING', oynuyor: 'PLAYING', playing: 'PLAYING', game: 'PLAYING',
  izle: 'WATCHING', izliyor: 'WATCHING', watching: 'WATCHING',
  dinle: 'LISTENING', dinliyor: 'LISTENING', listening: 'LISTENING',
  yaris: 'COMPETING', 'yarış': 'COMPETING', competing: 'COMPETING',
  yayin: 'STREAMING', 'yayın': 'STREAMING', streaming: 'STREAMING', stream: 'STREAMING',
};

const CLEAR_WORDS = new Set(['temizle', 'sil', 'kaldir', 'kaldır', 'clear', 'none', 'yok']);
const CUSTOM_WORDS = new Set(['ozel', 'özel', 'custom', 'cs', 'durum']);

/** Girdiyi geçerli bir Discord durumuna çevirir; geçersizse null. */
function resolveStatus(input) {
  if (!input) return null;
  return STATUS_MAP[String(input).toLowerCase()] ?? null;
}

const STATUS_LIST = 'online/çevrimiçi, idle/boşta, dnd/meşgul, invisible/görünmez';
const TYPE_LIST = 'oyna, izle, dinle, yayın, yarış, özel, temizle';

/**
 * Aktiviteyi uygular.
 * @returns {{ok:boolean, cleared?:boolean, type?:string, error?:string}}
 */
function setActivity(client, type, text = '', options = {}) {
  const key = String(type ?? '').toLowerCase();

  try {
    if (!type || CLEAR_WORDS.has(key)) {
      client.user.setActivity(null);
      return { ok: true, cleared: true };
    }

    if (CUSTOM_WORDS.has(key)) {
      const custom = new CustomStatus(client);
      if (text) custom.setState(text.slice(0, 128));
      if (options.emoji) custom.setEmoji(options.emoji);
      client.user.setPresence({ activities: [custom] });
      return { ok: true, type: 'CUSTOM' };
    }

    const activityType = TYPE_MAP[key];
    if (!activityType) {
      return { ok: false, error: `Geçersiz tip: "${type}". Kullan: ${TYPE_LIST}` };
    }
    if (!text) {
      return { ok: false, error: 'Metin gerekli.' };
    }

    const activity = { name: text.slice(0, 128), type: activityType };
    if (activityType === 'STREAMING') {
      activity.url = options.url || 'https://www.twitch.tv/discord';
    }
    client.user.setActivity(activity);
    return { ok: true, type: activityType };
  } catch (err) {
    logger.warn('[presence] Aktivite ayarlanamadı:', err.message);
    return { ok: false, error: err.message };
  }
}

/** config.presence içindeki durum + aktiviteyi uygular. */
function applyPresenceConfig(client, presence) {
  if (!presence) return;

  const status = resolveStatus(presence.status);
  if (status) {
    try {
      client.user.setStatus(status);
      logger.debug(`[presence] durum: ${status}`);
    } catch (err) {
      logger.warn('[presence] durum ayarlanamadı:', err.message);
    }
  }

  if (presence.activity?.type) {
    const res = setActivity(client, presence.activity.type, presence.activity.text ?? '', {
      emoji: presence.activity.emoji,
      url: presence.activity.url,
    });
    if (res.ok) logger.debug(`[presence] aktivite: ${presence.activity.type} ${presence.activity.text ?? ''}`);
  }
}

/** Durum döngüsünü başlatır (config.presence.rotate). */
function startRotation(client, presence) {
  stopRotation(client);

  const rotate = presence?.rotate;
  if (!rotate?.enabled || !Array.isArray(rotate.items) || !rotate.items.length) return false;

  const interval = Math.max(10000, rotate.intervalMs ?? 15000); // Discord alt sınırı ~15sn
  let index = 0;

  const tick = () => {
    const item = rotate.items[index % rotate.items.length];
    index += 1;
    if (item?.type) {
      setActivity(client, item.type, item.text ?? '', { emoji: item.emoji, url: item.url });
    }
  };

  tick(); // ilkini hemen uygula
  client._presenceRotation = setInterval(tick, interval);
  logger.info(`[presence] durum döngüsü başladı (${rotate.items.length} öğe, ${interval}ms)`);
  return true;
}

/** Durum döngüsünü durdurur. */
function stopRotation(client) {
  if (client._presenceRotation) {
    clearInterval(client._presenceRotation);
    client._presenceRotation = null;
    return true;
  }
  return false;
}

module.exports = {
  resolveStatus,
  setActivity,
  applyPresenceConfig,
  startRotation,
  stopRotation,
  STATUS_LIST,
  TYPE_LIST,
};
