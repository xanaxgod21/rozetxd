'use strict';

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

const EVENTS_DIR = path.join(__dirname, '..', 'events');

/**
 * src/events altındaki tüm .js dosyalarını client'a bağlar.
 * Her olay dosyası şu yapıda export etmeli:
 *   { name, once?, run(client, ...args) }
 */
function loadEvents(client) {
  if (!fs.existsSync(EVENTS_DIR)) {
    logger.warn('[olay] src/events klasörü yok, olay yüklenmedi.');
    return 0;
  }

  const files = fs.readdirSync(EVENTS_DIR).filter((file) => file.endsWith('.js'));
  let loaded = 0;

  for (const file of files) {
    const fullPath = path.join(EVENTS_DIR, file);

    try {
      const event = require(fullPath);

      if (!event?.name || typeof event.run !== 'function') {
        logger.warn(`[olay] ${file} atlandı: "name" ve "run" zorunlu.`);
        continue;
      }

      const handler = (...args) => {
        Promise.resolve(event.run(client, ...args)).catch((err) => {
          logger.error(`[olay] ${event.name} hatası:`, err);
        });
      };

      if (event.once) client.once(event.name, handler);
      else client.on(event.name, handler);

      loaded += 1;
      logger.debug(`[olay] bağlandı: ${event.name}`);
    } catch (err) {
      logger.error(`[olay] ${file} yüklenemedi:`, err);
    }
  }

  logger.info(`[olay] ${loaded} olay bağlandı.`);
  return loaded;
}

module.exports = { loadEvents };
