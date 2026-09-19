'use strict';

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

/**
 * src/commands altındaki tüm .js dosyalarını okur ve client.commands'a yükler.
 * Her komut dosyası şu yapıda export etmeli:
 *   { name, description?, aliases?, usage?, category?, run(ctx) }
 */
function loadCommands(client) {
  client.commands.clear();
  client.aliases.clear();

  if (!fs.existsSync(COMMANDS_DIR)) {
    logger.warn('[komut] src/commands klasörü yok, komut yüklenmedi.');
    return 0;
  }

  const files = fs.readdirSync(COMMANDS_DIR).filter((file) => file.endsWith('.js'));
  let loaded = 0;

  for (const file of files) {
    const fullPath = path.join(COMMANDS_DIR, file);

    try {
      delete require.cache[require.resolve(fullPath)];
      const command = require(fullPath);

      if (!command?.name || typeof command.run !== 'function') {
        logger.warn(`[komut] ${file} atlandı: "name" ve "run" zorunlu.`);
        continue;
      }

      if (client.commands.has(command.name)) {
        logger.warn(`[komut] ${file} atlandı: "${command.name}" zaten kayıtlı.`);
        continue;
      }

      client.commands.set(command.name, command);

      for (const alias of command.aliases ?? []) {
        if (client.aliases.has(alias)) {
          logger.warn(`[komut] "${alias}" takma adı çakışıyor, atlandı.`);
          continue;
        }
        client.aliases.set(alias, command.name);
      }

      loaded += 1;
      logger.debug(`[komut] yüklendi: ${command.name}`);
    } catch (err) {
      logger.error(`[komut] ${file} yüklenemedi:`, err);
    }
  }

  logger.info(`[komut] ${loaded} komut yüklendi.`);
  return loaded;
}

/** İsim veya takma ada göre komut bulur. */
function resolveCommand(client, name) {
  const key = name.toLowerCase();
  return client.commands.get(key) ?? client.commands.get(client.aliases.get(key));
}

module.exports = { loadCommands, resolveCommand };
