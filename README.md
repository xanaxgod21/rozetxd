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

## Kurulum

```bash
# 1) Bağımlılıkları kur
npm install

# 2) Ayar dosyasını oluştur
cp .env.example .env

# 3) .env içini doldur (TOKEN zorunlu, WEBHOOK_URL opsiyonel)

# 4) Çalıştır
npm start
```

Geliştirirken dosya değiştikçe otomatik yeniden başlatmak için:

```bash
npm run dev
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
