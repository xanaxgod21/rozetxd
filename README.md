# rozetxd

Modüler komut sistemi ve Discord webhook loglaması olan bir Discord self-bot iskeleti.

> [!WARNING]
> **Self-bot kullanımı Discord Hizmet Şartları'na aykırıdır.** Kullanıcı token'ı ile
> hesap otomasyonu yapmak hesabının kalıcı olarak kapatılmasına yol açabilir.
> Bu projeyi kullanma riski tamamen sana aittir.

> [!CAUTION]
> **Token'ını kimseyle paylaşma.** Token'ın hesabına tam erişim demektir.
> `.env` dosyası `.gitignore` içinde — asla commit'leme, ekran görüntüsü alma,
> "token'ını gönder yardım edeyim" diyen kimseye verme.

## VDS'e kurulum

Sunucuya bağlan ve tek script ile hallet:

```bash
# 1) Projeyi çek
git clone https://github.com/xanaxgod21/rozetxd.git
cd rozetxd

# 2) Kurulum scriptini çalıştır (token'ı sana soracak)
chmod +x setup.sh
./setup.sh
```

Script şunları yapar: Node.js sürümünü kontrol eder, bağımlılıkları kurar,
`.env` dosyasını oluşturup token'ını sorar (ekranda görünmez) ve dosya iznini
`600` yapar, ayarları doğrular.

Node.js kurulu değilse (Ubuntu/Debian):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Windows VDS (PowerShell)

PowerShell'i **yönetici olarak** aç:

```powershell
# Node.js ve git yoksa (winget ile):
winget install OpenJS.NodeJS.LTS
winget install Git.Git
# Kurduktan sonra PowerShell'i kapatıp yeniden aç

git clone -b claude/self-bot-project-icch3r https://github.com/xanaxgod21/rozetxd.git
cd rozetxd

# Tek script ile kurulum (token'ı sorar):
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

7/24 çalışması için (pm2, Windows'ta boot'ta otomatik başlatma dahil):

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start ecosystem.config.js
pm2 save
pm2 logs rozetxd
```

### 7/24 çalıştırma — pm2 (önerilen)

`npm start` ile başlatırsan SSH bağlantın kopunca bot da durur. pm2 kullan:

```bash
sudo npm install -g pm2

pm2 start ecosystem.config.js   # başlat
pm2 logs rozetxd                # logları canlı izle
pm2 restart rozetxd             # yeniden başlat
pm2 stop rozetxd                # durdur
pm2 status                      # durum

# Sunucu yeniden başladığında bot da otomatik açılsın:
pm2 save
pm2 startup                     # çıktıdaki komutu sudo ile çalıştır
```

pm2 ayarları `ecosystem.config.js` içinde: çökerse otomatik kalkar (arka arkaya
çökme durumunda araları açarak, sonsuz döngüye girmeden), 300MB belleği aşarsa
yeniden başlar, loglar `logs/` klasörüne yazılır.

> [!IMPORTANT]
> Aynı token ile **birden fazla kopya çalıştırma**. Komutlar iki kez çalışır ve
> Discord oturumu bozulur. `ecosystem.config.js` bu yüzden `instances: 1`.

### Alternatif: systemd

pm2 istemiyorsan `deploy/rozetxd.service` hazır:

```bash
sudo useradd -r -m -d /opt/rozetxd -s /usr/sbin/nologin rozetxd
sudo cp -r . /opt/rozetxd && sudo chown -R rozetxd:rozetxd /opt/rozetxd

sudo cp deploy/rozetxd.service /etc/systemd/system/
sudo nano /etc/systemd/system/rozetxd.service   # node yolunu kontrol et: which node
sudo systemctl daemon-reload
sudo systemctl enable --now rozetxd

journalctl -u rozetxd -f        # logları izle
```

### Alternatif: Docker

```bash
cp .env.example .env && nano .env    # token'ı gir
docker compose up -d

docker compose logs -f               # logları izle
docker compose restart               # yeniden başlat
docker compose down                  # durdur
```

### Güncelleme

```bash
cd rozetxd
git pull
npm ci --omit=dev
pm2 restart rozetxd
```

## Yerelde geliştirme

```bash
npm install
cp .env.example .env    # TOKEN'ı doldur
npm start

npm run dev             # dosya değiştikçe otomatik yeniden başlat
```

## Ayarlar

`.env` dosyası (gizli bilgiler):

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `TOKEN` | ✅ | Discord hesabının user token'ı |
| `PREFIX` | — | Komut ön eki (varsayılan `.`) |
| `WEBHOOK_URL` | — | Logların gideceği Discord webhook adresi |
| `OWNER_IDS` | — | Komut kullanabilecek ID'ler, virgülle ayrılır. Boşsa sadece kendi hesabın |
| `LOG_LEVEL` | — | `debug` \| `info` \| `warn` \| `error` |

`config.json` dosyası (gizli olmayan tercihler): ön ek, durum (`presence`) ve hangi
olayların webhook'a gideceği (`webhook.ready`, `webhook.commands`, `webhook.errors`).

## Komutlar

| Komut | Takma adlar | Açıklama |
| --- | --- | --- |
| `.help [komut]` | `yardim`, `komutlar`, `h` | Komut listesi veya tek komut detayı |
| `.ping` | `gecikme`, `p` | API gecikmesi ve çalışma süresi |
| `.webhook test` | `wh` | Webhook bağlantısını test eder |
| `.webhook gonder <mesaj>` | `wh` | Webhook üzerinden mesaj gönderir |
| `.reload` | `yenile`, `rl` | Komutları botu kapatmadan yeniden yükler |
| `.durum <tip>` | `status` | Çevrimiçi durumu değiştirir (online/boşta/meşgul/görünmez) |
| `.aktivite <tip> <metin>` | `oyna`, `izle`, `dinle`, `ozeldurum` | Profil aktivitesi (oynuyor/izliyor/dinliyor/özel durum) |
| `.dongu <ac\|kapat>` | `rotate` | config.json'daki durum döngüsünü aç/kapat |
| `.nadir [sunucu]` | `rare`, `rozet` | Üye olunan sunucudaki nadir rozetli üyeleri listeler |

## Yeni komut ekleme

`src/commands/` altına bir `.js` dosyası at, bot açıkken `.reload` yaz — hazır.

```js
'use strict';

module.exports = {
  name: 'selam',
  aliases: ['merhaba'],
  description: 'Selam verir.',
  usage: 'selam [isim]',
  category: 'genel',
  cooldown: 2000, // ms, opsiyonel

  async run({ client, message, args, config, logger, webhook }) {
    await message.channel.send(`Selam ${args[0] ?? 'dünya'}!`);
  },
};
```

Komutu **herkesin** (sadece owner değil) kullanabilmesi için komuta `everyone: true` ekle. Token'ı girilen hesap (self-bot) komutu işler.

`run` fonksiyonuna gelen alanlar:

- `client` — self-bot istemcisi
- `message` — komutu tetikleyen mesaj
- `args` — komut adından sonraki kelimeler (dizi)
- `config` — ayarlar
- `logger` — `debug/info/warn/error` (token'ı otomatik maskeler)
- `webhook` — `text()`, `embed()`, `error()`

## Yeni olay ekleme

`src/events/` altına ekle, bot yeniden başlayınca otomatik bağlanır:

```js
module.exports = {
  name: 'messageDelete',
  once: false,
  run(client, message) {
    client.logger.info(`Mesaj silindi: ${message.id}`);
  },
};
```

## Nadir rozet taraması

Hesabın **zaten üye olduğu** bir sunucudaki nadir Discord rozetine (badge) sahip
kişileri listeler. **Sunucuya katılmaz** — sen sunuculara elle girersin, bot
sadece içinde olduğun sunucuları tarar (otomatik katılma hesabı yaktığı için
kaldırıldı).

**İki kullanım:**

1. **Otomatik (sen sunucuya girince):** Hesabın bir sunucuya **elle** girdiği an
   bot otomatik tarar. Katılmayı sen yaparsın, bot sadece giriş olayını
   (`guildCreate`) yakalayıp tarar. Sonuç şu sırayla teslim edilir:
   - `outputGuildId` ayarlıysa → o **kontrol sunucunda** taranan sunucu için
     `<isim>-rozetler` adında bir kanal **açar** (aynı isim varsa tekrar
     kullanır) ve raporu oraya atar.
   - yoksa `outputChannelId` (tek sabit kanal) → oraya atar.
   - o da yoksa webhook (embed + tam liste `.txt`).
2. **Komut:**
   - `.nadir` → komutu yazdığın sunucuyu tarar
   - `.nadir <sunucu ID>` → o ID'li sunucuyu tarar (hesabın üye olduğu)
   - `.nadir <sunucu adı>` → adı eşleşen sunucuyu tarar

Sonuç: özet embed (kaç üye tarandı, rozet başına sayı) + tam listenin olduğu
bir `.txt` eki. Bot tek istekte tüm üyeleri çeker (`query=''`, presence yok);
kalabalık sunucuda sürebilir, `config.json > rareScan.fetchTimeoutMs` ile süreyi
ayarlarsın. Nadir sayılan rozetler `rareScan.rareFlags` listesinden gelir.

## Ayarlar (`config.json` > `rareScan`)

| Ayar | Açıklama |
| --- | --- |
| `autoScanOnJoin` | Sen bir sunucuya girince otomatik tarasın mı (varsayılan **açık**) |
| `outputGuildId` | **Kendi kontrol sunucun** (kanal açma yetkin olan). Bot her taranan sunucu için `<isim>-rozetler` kanalı açar. `.env`'de `OUTPUT_GUILD_ID` |
| `outputCategoryId` | (Opsiyonel) Açılan kanalların konacağı kategori ID'si |
| `channelSuffix` | Kanal adının sonuna eklenen ek (varsayılan `-rozetler`) |
| `outputChannelId` | `outputGuildId` yoksa sonucun gideceği tek sabit kanal. O da yoksa webhook |
| `fetchTimeoutMs` | Tüm üyeler bu süre içinde gelmezse **hata verir, yarım listeyle devam etmez**. Kalabalık sunucu için yüksek tut (varsayılan 300000 = 5dk) |
| `rareFlags` | "Nadir" sayılan rozetler (Discord UserFlags isimleri) |

Varsayılan nadir rozetler: Discord Personeli, Partner, HypeSquad Events,
Bug Hunter (1 & 2), Erken Destekçi, Erken Doğrulanmış Bot Geliştirici,
Moderatör Programı Mezunu. HypeSquad evleri ve Aktif Geliştirici gibi kolay
alınanlar varsayılanda **yok** — istersen `rareFlags`'e ekleyebilirsin.

> [!NOTE]
> Bu tarama sunucuya **katılmaz**, sadece hesabın zaten üye olduğu sunucuları
> tarar. Yine de **tüm üye listesini çekmek** Discord'un otomasyon tespitini
> tetikleyebilir; nadir de olsa hesabın için bir risktir.

## Profil / görünüm

Self-bot hesabının durumunu ve aktivitesini ayarlar.

**Durum:** `.durum online` · `boşta` · `meşgul` · `görünmez`

**Aktivite:**
- `.oyna Minecraft` → "Minecraft oynuyor"
- `.izle Netflix` → "Netflix izliyor"
- `.dinle Spotify` → "Spotify dinliyor"
- `.aktivite yayın <metin>` → yayında
- `.ozeldurum 😎 takılıyorum` → özel durum (emoji opsiyonel)
- `.aktivite temizle` → aktiviteyi kaldır

**Otomatik (config.json > `presence`):** Bot açılışta `status` + `activity`
değerlerini uygular. `rotate.enabled: true` yaparsan `rotate.items`
listesindeki durumları `intervalMs` aralığıyla döndürür (Discord alt sınırı
~15sn). Çalışırken `.dongu ac` / `.dongu kapat` ile de kontrol edebilirsin.

```json
"presence": {
  "status": "online",
  "activity": { "type": "oyna", "text": "rozetxd" },
  "rotate": {
    "enabled": false,
    "intervalMs": 15000,
    "items": [
      { "type": "oyna", "text": "rozetxd" },
      { "type": "izle", "text": "sunucuları" }
    ]
  }
}
```

## Webhook kullanımı

```js
const webhook = require('./src/utils/webhook');

await webhook.text('düz mesaj');

await webhook.embed({
  title: 'Başlık',
  description: 'Açıklama',
  color: 0x57f287,
  fields: [{ name: 'Alan', value: 'Değer', inline: true }],
  footer: 'altbilgi',
});

await webhook.error('Bir şey patladı', hataNesnesi);
```

İstekler sıraya alınır (aynı anda tek istek), `429` yenirse Discord'un verdiği
süre kadar beklenip tekrar denenir, gönderilen metin token/webhook adresi
sızmasına karşı maskelenir ve `@everyone` gibi etiketler devre dışıdır.

## Klasör yapısı

```
rozetxd/
├── setup.sh              # VDS kurulum scripti
├── ecosystem.config.js   # pm2 ayarları
├── Dockerfile            # docker ile çalıştırma
├── docker-compose.yml
├── deploy/
│   └── rozetxd.service   # systemd servis dosyası
├── config.json           # gizli olmayan ayarlar
├── .env                  # gizli bilgiler (git'e girmez)
└── src/
    ├── index.js          # giriş noktası
    ├── config.js         # ayar okuma + doğrulama
    ├── commands/         # komutlar (otomatik yüklenir)
    ├── events/           # olaylar (otomatik yüklenir)
    ├── handlers/         # komut/olay yükleyiciler
    └── utils/
        ├── logger.js     # renkli konsol logu + maskeleme
        └── webhook.js    # webhook gönderici
```
