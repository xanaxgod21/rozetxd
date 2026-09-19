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
| `WATCH_CHANNEL_ID` | — | Nadir rozet taramasının dinleyeceği kanal ID'si |

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
| `.gir <davet>` | `join`, `katil` | Davetteki sunucuya girer ve kalır (tarama yapmaz) |
| `.nadir <davet>` | `rare`, `rozet` | Davetteki sunucuya girip nadir rozetli üyeleri listeler |

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

Bir sunucudaki nadir Discord rozetine (badge) sahip kişileri bulur.

**İki kullanım şekli var:**

1. **İzlenen kanal (otomatik):** `WATCH_CHANNEL_ID` ile belirlediğin kanala bir
   davet linki yazarsın (örn. `https://discord.gg/xxxx`), bot o sunucuya girip
   nadir rozetlileri o kanala döker. Kanalı `.env`'deki `WATCH_CHANNEL_ID` veya
   `config.json`'daki `watchChannelId` belirler.

2. **Komut:** `.nadir <davet linki>` — istediğin kanaldan çalıştırırsın.

Sonuç: bir özet embed (kaç üye tarandı, rozet başına sayı) + tam listenin
olduğu bir `.txt` eki (her satır: `kullanıcı (id) — rozetleri`).

**Üye çekme hızı:** Bot tek bir istekle sunucudaki *herkesi* ister
(`query=''`, `limit=0`) ve presence verisi çekmez — bu, tam listeyi almanın en
hızlı yoludur. Buradan sonrası Discord'un gateway'ine bağlıdır: üyeler 1000'erlik
parçalar halinde Discord ne kadar hızlı yollarsa o hızda gelir. Client tarafında
yapay bir bekleme yoktur; gateway'i daha fazla zorlamak bağlantıyı düşürür veya
hesabı ban ettirir, hızlandırmaz.

### Ayarlar (`config.json` > `rareScan`)

| Ayar | Açıklama |
| --- | --- |
| `autoJoinFromWatchChannel` | İzlenen kanaldaki davetlerle otomatik girsin mi |
| `maxMembers` | Bundan kalabalık sunucuda tarama yapma. **`0` = sınır yok** (kalabalık sunucular da taranır) |
| `cooldownMs` | İki tarama arası bekleme (spam-join engeli). Düşük = daha hızlı ardışık tarama, daha yüksek ban riski. `0` = beklemesiz (varsayılan 5000) |
| `fetchTimeoutMs` | Tüm üyeler bu süre içinde gelmezse **hata verir, yarım listeyle devam etmez**. Kalabalık sunucu için yüksek tut (varsayılan 300000 = 5dk) |
| `leaveAfterScan` | Tarama bitince sunucudan otomatik çıksın mı (varsayılan **açık**) |
| `rareFlags` | "Nadir" sayılan rozetler (Discord UserFlags isimleri) |

Varsayılan nadir rozetler: Discord Personeli, Partner, HypeSquad Events,
Bug Hunter (1 & 2), Erken Destekçi, Erken Doğrulanmış Bot Geliştirici,
Moderatör Programı Mezunu. HypeSquad evleri ve Aktif Geliştirici gibi kolay
alınanlar varsayılanda **yok** — istersen `rareFlags`'e ekleyebilirsin.

> [!CAUTION]
> Davet linkiyle **otomatik sunucuya girmek** ve **tüm üye listesini çekmek**,
> Discord'un otomasyon tespitinde en çok işaretlediği iki davranıştır. Bu özellik
> ana hesabının ban riskini belirgin şekilde artırır. `maxMembers` ve
> `cooldownMs`'i düşük tutmak riski azaltır ama sıfırlamaz.

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
