'use strict';

const { scanGuild, buildReport } = require('../utils/rareScan');
const { deliverReport } = require('../utils/deliver');

// Aynı anda tek otomatik tarama
let scanning = false;

module.exports = {
  name: 'guildCreate',

  async run(client, guild) {
    const { config, logger, webhook } = client;
    const { rareScan } = config;

    // Teşhis için: olay tetiklenir tetiklenmez, filtrelerden ÖNCE logla
    logger.info(`[nadir] guildCreate tetiklendi: "${guild?.name}" (${guild?.id})`);

    if (!rareScan.autoScanOnJoin) {
      logger.info('[nadir] autoScanOnJoin kapalı, tarama atlandı.');
      return;
    }

    // Açılışta sunucular guildCreate ile yüklenir; o dalgayı tarama.
    // Sadece hazır olduktan sonraki GERÇEK katılımları tara.
    const sinceReady = client._readyAt ? Date.now() - client._readyAt : -1;
    if (sinceReady < 10000) {
      logger.info(`[nadir] Açılış penceresinde (${sinceReady}ms), tarama atlandı.`);
      return;
    }

    if (scanning) {
      logger.warn(`[nadir] Zaten tarama sürüyor, "${guild.name}" atlandı.`);
      return;
    }
    scanning = true;

    logger.info(`[nadir] Yeni sunucuya girildi: "${guild.name}" — otomatik taranıyor...`);

    try {
      const result = await scanGuild(client, guild);
      const report = buildReport(result);

      // Kontrol sunucusunda "<isim>-rozetler" kanalı aç/bul ve oraya at
      // (yoksa sabit kanal, yoksa webhook)
      await deliverReport(client, result.guildName, report);

      logger.info(`[nadir] "${result.guildName}" otomatik tarandı: ${result.rareMembers.length} nadir rozetli.`);
    } catch (err) {
      logger.error('[nadir] Otomatik tarama hatası:', err);
      if (webhook.enabled) await webhook.error('Otomatik tarama', err);
    } finally {
      scanning = false;
    }
  },
};
