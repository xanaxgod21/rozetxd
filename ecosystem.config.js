'use strict';

/**
 * pm2 yapılandırması — VDS'te 7/24 çalıştırmak için.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 logs rozetxd
 *   pm2 restart rozetxd
 *   pm2 save && pm2 startup    # sunucu yeniden başlayınca otomatik açılsın
 */
module.exports = {
  apps: [
    {
      name: 'rozetxd',
      script: 'src/index.js',
      cwd: __dirname,

      // ÖNEMLİ: Aynı token ile birden fazla kopya çalıştırma.
      // Komutlar iki kez çalışır ve Discord oturumu bozulur.
      instances: 1,
      exec_mode: 'fork',

      // Çökerse kaldır, ama sonsuz döngüye girmesin
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,

      // Bellek sızıntısına karşı emniyet
      max_memory_restart: '300M',

      // Sunucuda dosya izlemeyi açma, gereksiz yeniden başlatma yapar
      watch: false,

      time: true,
      merge_logs: true,
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',

      env: {
        NODE_ENV: 'production',
        NO_COLOR: '1',
      },
    },
  ],
};
