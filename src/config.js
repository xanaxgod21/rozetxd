'use strict';

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');

/** .env'deki virgüllü listeyi diziye çevirir. */
function parseList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** config.json varsa okur, yoksa boş obje döner. */
function readJsonConfig() {
  const file = path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[config] config.json okunamadı, varsayılanlar kullanılıyor: ${err.message}`);
    return {};
  }
}

const json = readJsonConfig();

const config = {
  token: process.env.TOKEN ?? '',
  prefix: process.env.PREFIX ?? json.prefix ?? '.',
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  ownerIds: parseList(process.env.OWNER_IDS),
  logLevel: process.env.LOG_LEVEL ?? json.logLevel ?? 'info',

  // config.json üzerinden ayarlanan, token gerektirmeyen tercihler
  presence: json.presence ?? null,
  webhook: {
    // Hangi olaylar webhook'a gitsin
    ready: json.webhook?.ready ?? true,
    commands: json.webhook?.commands ?? true,
    errors: json.webhook?.errors ?? true,
    username: json.webhook?.username ?? 'rozetxd',
    avatarUrl: json.webhook?.avatarUrl ?? null,
  },
};

/**
 * Bot açılmadan önce zorunlu alanları doğrular.
 * Eksik varsa okunabilir bir hata fırlatır.
 */
function validate() {
  const errors = [];

  if (!config.token) {
    errors.push('TOKEN tanımlı değil. .env.example dosyasını .env olarak kopyalayıp doldur.');
  }

  if (config.webhookUrl && !/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//i.test(config.webhookUrl)) {
    errors.push('WEBHOOK_URL geçerli bir Discord webhook adresi değil.');
  }

  if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    errors.push(`LOG_LEVEL geçersiz: "${config.logLevel}" (debug|info|warn|error olmalı)`);
  }

  if (errors.length) {
    throw new Error(`Yapılandırma hatası:\n  - ${errors.join('\n  - ')}`);
  }
}

module.exports = { config, validate };
