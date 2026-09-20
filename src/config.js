'use strict';

const path = require('node:path');
const fs = require('node:fs');

// .env her zaman proje kökünden okunur; böylece botu hangi dizinden
// başlatırsan başlat (systemd, pm2, docker) ayarlar bulunur.
//
// override: true -> bu klasörün .env'i her zaman kazanır. Sistemde global bir
// TOKEN ortam değişkeni olsa bile onu ezer. Aynı VDS'te iki bot çalıştırırken
// ikisinin aynı token'a düşmesini engeller: her bot kendi .env'ini kullanır.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

/**
 * Token'ı temizler: baş/son tırnak, "Bot " öneki, her türlü boşluk/newline.
 * Yanlış yapıştırma kaynaklı görünmez karakterleri de atar.
 */
function cleanToken(raw) {
  let t = String(raw ?? '').trim();
  t = t.replace(/^["']|["']$/g, '').trim(); // baş/son tırnak
  t = t.replace(/^Bot\s+/i, ''); // yanlışlıkla "Bot " öneki (self-bot user token ister)
  t = t.replace(/\s+/g, ''); // token'da boşluk olmaz
  return t;
}

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
  token: cleanToken(process.env.TOKEN),
  prefix: process.env.PREFIX ?? json.prefix ?? '.',
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  ownerIds: parseList(process.env.OWNER_IDS),
  logLevel: process.env.LOG_LEVEL ?? json.logLevel ?? 'info',

  // config.json üzerinden ayarlanan, token gerektirmeyen tercihler
  presence: json.presence ?? null,

  // Nadir rozet taraması (yalnızca hesabın ZATEN üye olduğu sunucular; katılma yok)
  rareScan: {
    // Sen bir sunucuya elle girdiğin an bot otomatik tarasın mı
    autoScanOnJoin: json.rareScan?.autoScanOnJoin ?? true,
    // Sonuçların yazılacağı KONTROL sunucusu (senin, kanal açma yetkin olan).
    // Bot burada her taranan sunucu için "<isim>-rozetler" kanalı açar.
    outputGuildId: process.env.OUTPUT_GUILD_ID ?? json.rareScan?.outputGuildId ?? '',
    // İsteğe bağlı: açılan kanalların konacağı kategori ID'si.
    outputCategoryId: process.env.OUTPUT_CATEGORY_ID ?? json.rareScan?.outputCategoryId ?? '',
    // Açılan kanal adının sonuna eklenecek ek. "-rozetler" -> "xx-rozetler"
    channelSuffix: json.rareScan?.channelSuffix ?? '-rozetler',
    // Alternatif: outputGuildId yoksa buraya (tek sabit kanal ID) gönderir.
    // Boşsa webhook'a gönderilir (WEBHOOK_URL varsa).
    outputChannelId: process.env.OUTPUT_CHANNEL_ID ?? json.rareScan?.outputChannelId ?? '',
    // Üye çekme için süre bütçesi (deepScan kapalıyken). Süre dolarsa o ana
    // kadar gelen üyelerle (kısmi) devam eder.
    fetchTimeoutMs: json.rareScan?.fetchTimeoutMs ?? 90000,
    // DERİN TARAMA: isim ön-ekiyle (a,b,c,...) tekrar tekrar sorgu atıp büyük
    // sunucularda çok daha fazla üye toplar. Kapatmak için false yap.
    deepScan: json.rareScan?.deepScan ?? true,
    // Derin taramada en fazla kaç sorgu atılsın (yüksek = daha çok üye, daha
    // uzun süre, daha yüksek ban riski).
    deepScanMaxRequests: json.rareScan?.deepScanMaxRequests ?? 600,
    // Derin tarama toplam süre bütçesi (ms).
    deepScanTimeBudgetMs: json.rareScan?.deepScanTimeBudgetMs ?? 300000,
    // Sorgular arası bekleme (ms) — düşük = hızlı ama daha riskli.
    deepScanDelayMs: json.rareScan?.deepScanDelayMs ?? 200,
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
