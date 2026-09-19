'use strict';

const { resolveCommand } = require('../handlers/commands');

const DEFAULT_COOLDOWN_MS = 1500;

module.exports = {
  name: 'messageCreate',

  async run(client, message) {
    const { config, logger, webhook } = client;

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = resolveCommand(client, commandName);
    if (!command) return;

    // Yetki: normalde sadece yetkili hesaplar (varsayılan: sen) kullanabilir.
    // Ama "everyone: true" işaretli komutları herkes tetikleyebilir; komutu
    // işleyen token hesabı (self-bot) işi yapar.
    const isOwner = config.ownerIds.includes(message.author.id);
    if (!command.everyone && !isOwner) return;

    // Basit cooldown — arka arkaya spam komutu engeller
    const cooldownMs = command.cooldown ?? DEFAULT_COOLDOWN_MS;
    const cooldownKey = `${message.author.id}:${command.name}`;
    const expiresAt = client.cooldowns.get(cooldownKey);

    if (expiresAt && Date.now() < expiresAt) {
      const remaining = ((expiresAt - Date.now()) / 1000).toFixed(1);
      logger.debug(`[komut] ${command.name} bekleme süresinde (${remaining}s)`);
      return;
    }
    client.cooldowns.set(cooldownKey, Date.now() + cooldownMs);

    try {
      await command.run({ client, message, args, config, logger, webhook });
      logger.info(`[komut] ${command.name} çalıştırıldı`);

      if (config.webhook.commands) {
        await webhook.embed({
          title: '⚡ Komut çalıştırıldı',
          color: 0x5865f2,
          fields: [
            { name: 'Komut', value: `\`${config.prefix}${command.name}\``, inline: true },
            { name: 'Sunucu', value: message.guild?.name ?? 'DM', inline: true },
            { name: 'Kanal', value: message.channel?.name ?? 'DM', inline: true },
            ...(args.length ? [{ name: 'Argümanlar', value: `\`${args.join(' ')}\`` }] : []),
          ],
        });
      }
    } catch (err) {
      logger.error(`[komut] ${command.name} hatası:`, err);

      if (config.webhook.errors) {
        await webhook.error(`Komut hatası: ${command.name}`, err);
      }

      // Kendi mesajımızı düzenleyerek hatayı bildir
      await message.channel
        .send(`\`❌ Hata: ${err.message.slice(0, 200)}\``)
        .catch(() => null);
    }
  },
};
