'use strict';

const { scanGuild, buildReport } = require('../utils/rareScan');

// Aynı anda tek otomatik tarama
let scanning = false;

module.exports = {
  name: 'guildCreate',

  async run(client, guild) {
    const { config, logger, webhook } = client;
    const { rareScan } = config;

    if (!rareScan.autoScanOnJoin) return;

    // Açılışta sunucular guildCreate ile yüklenir; o dalgayı tarama.
    // Sadece hazır olduktan sonraki GERÇEK katılımları tara.
    if (!client._readyAt || Date.now() - client._readyAt < 10000) return;

    if (scanning) {
      logger.warn(`[nadir] Zaten tarama sürüyor, "${guild.name}" atlandı.`);
      return;
    }
    scanning = true;

    logger.info(`[nadir] Yeni sunucuya girildi: "${guild.name}" — otomatik taranıyor...`);

    try {
      const result = await scanGuild(client, guild);
      const report = buildReport(result);

      let posted = false;

      // 1) Ayarlı bir çıktı kanalı varsa oraya tam raporu at
      const chId = rareScan.outputChannelId;
      if (chId) {
        const channel = client.channels.cache.get(chId);
        if (channel?.send) {
          await channel.send(report).catch((err) =>
            logger.warn(`[nadir] Çıktı kanalına gönderilemedi: ${err.message}`),
          );
          posted = true;
        } else {
          logger.warn(`[nadir] outputChannelId (${chId}) bulunamadı veya yazılamıyor.`);
        }
      }

      // 2) Webhook varsa oraya da tam raporu (embed + .txt) at
      if (webhook.enabled) {
        await webhook.sendReport(report);
        posted = true;
      }

      if (!posted) {
        logger.warn(
          '[nadir] Sonuç gönderilecek yer yok. config.json > rareScan.outputChannelId ' +
            'veya .env WEBHOOK_URL ayarla.',
        );
      }

      logger.info(`[nadir] "${result.guildName}" otomatik tarandı: ${result.rareMembers.length} nadir rozetli.`);
    } catch (err) {
      logger.error('[nadir] Otomatik tarama hatası:', err);
      if (webhook.enabled) await webhook.error('Otomatik tarama', err);
    } finally {
      scanning = false;
    }
  },
};
