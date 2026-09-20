'use strict';

const { Client, Collection } = require('discord.js-selfbot-v13');

const { config, validate } = require('./config');
const logger = require('./utils/logger');
const webhook = require('./utils/webhook');
const { loadCommands } = require('./handlers/commands');
const { loadEvents } = require('./handlers/events');

// Yapılandırmayı bot açılmadan doğrula
try {
  validate();
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

const client = new Client({
  checkUpdate: false,
  syncStatus: false,
});

// Komut kayıtları ve paylaşılan yardımcılar
client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();
client.config = config;
client.logger = logger;
client.webhook = webhook;
client.startedAt = Date.now();

loadCommands(client);
loadEvents(client);

// Beklenmeyen hatalar botu düşürmesin, ama kayda geçsin
process.on('unhandledRejection', (reason) => {
  logger.error('İşlenmemiş promise hatası:', reason);
  if (config.webhook.errors) webhook.error('İşlenmemiş promise hatası', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış istisna:', err);
  if (config.webhook.errors) webhook.error('Yakalanmamış istisna', err);
});

// Ctrl+C / kill ile temiz kapanış
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    logger.info(`${signal} alındı, kapatılıyor...`);
    try {
      await webhook.embed({ title: '🔴 Bot kapatıldı', color: 0xed4245 });
      client.destroy();
    } finally {
      process.exit(0);
    }
  });
}

// Teşhis: token'ın ŞEKLİ (içeriği değil). Geçerli bir user token "A.B.C"
// biçiminde 3 parçalı ve tipik olarak ~70+ karakterdir. Bunun dışındaysa
// büyük ihtimalle eksik/yanlış kopyalanmış demektir.
{
  const parts = config.token.split('.');
  logger.info(`Token şekli: ${config.token.length} karakter, ${parts.length} parça (nokta ile).`);
  if (parts.length !== 3) {
    logger.warn('Token 3 parçalı (A.B.C) değil — büyük ihtimalle eksik/yanlış kopyalanmış.');
  } else if (config.token.length < 50) {
    logger.warn('Token beklenenden kısa — eksik kopyalanmış olabilir.');
  }
}

client.login(config.token).catch((err) => {
  logger.error('Giriş başarısız. Token geçersiz veya süresi dolmuş olabilir.');
  logger.error(err.message);
  logger.error(
    'ÖNEMLİ: Bu hatayı Discord veriyor, kod değil. Ya token yanlış/eksik ' +
      'kopyalandı, ya bot token\'ı girildi (user token olmalı), ya da hesap ' +
      'kilitli/yanmış. Hesaba tarayıcıdan normal giriş yapabildiğinden emin ol.',
  );
  process.exit(1);
});

module.exports = client;
