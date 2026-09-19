'use strict';

const path = require('node:path');
const fs = require('node:fs');

// .env her zaman proje kökünden okunur; böylece botu hangi dizinden
// başlatırsan başlat (systemd, pm2, docker) ayarlar bulunur.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

  // Nadir rozet taraması: bu kanala davet yazılınca bot sunucuya girip tarar
  watchChannelId: process.env.WATCH_CHANNEL_ID ?? json.watchChannelId ?? '',
  rareScan: {
    // İzlenen kanaldaki davetlerle otomatik sunucuya girsin mi
    autoJoinFromWatchChannel: json.rareScan?.autoJoinFromWatchChannel ?? true,
    // Bundan fazla üyesi olan sunucuda tarama yapma. 0 = sınır yok
    // (kalabalık sunucular da taranır; ban riski + süre artar)
    maxMembers: json.rareScan?.maxMembers ?? 0,
    // İki tarama arası bekleme (spam-join engeli). Düşük = daha hızlı ardışık
    // tarama ama daha yüksek ban riski. 0 = bekleme yok.
    cooldownMs: json.rareScan?.cooldownMs ?? 5000,
    // Tüm üyeler bu süre içinde gelmezse hata verir (yarım listeyle devam etmez).
    // Kalabalık sunucular için yüksek tut.
    fetchTimeoutMs: json.rareScan?.fetchTimeoutMs ?? 300000,
    // Tarama sonrası sunucudan otomatik çıksın mı
    leaveAfterScan: json.rareScan?.leaveAfterScan ?? true,
    // "Nadir" sayılan rozetler (UserFlags isimleri)
    rareFlags: json.rareScan?.rareFlags ?? [
      'DISCORD_EMPLOYEE',
      'PARTNERED_SERVER_OWNER',
      'HYPESQUAD_EVENTS',
      'BUGHUNTER_LEVEL_1',
      'BUGHUNTER_LEVEL_2',
      'EARLY_SUPPORTER',
      'EARLY_VERIFIED_BOT_DEVELOPER',
      'DISCORD_CERTIFIED_MODERATOR',
    ],
  },
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
// .env.example'dan kopyalanıp doldurulmayı unutulan değerler
const PLACEHOLDER_TOKENS = new Set([
  'buraya_user_tokenini_yaz',
  'your_token_here',
  'token',
  'xxx',
]);

function validate() {
  const errors = [];

  if (!config.token) {
    errors.push('TOKEN tanımlı değil. .env.example dosyasını .env olarak kopyalayıp doldur.');
  } else if (PLACEHOLDER_TOKENS.has(config.token.toLowerCase())) {
    errors.push('TOKEN hâlâ örnek değerde. .env dosyasını açıp gerçek token ile değiştir.');
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
