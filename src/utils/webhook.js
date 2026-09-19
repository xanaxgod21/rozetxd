'use strict';

const { config } = require('../config');
const logger = require('./logger');

/**
 * Discord webhook gönderici.
 *
 * - İstekleri sıraya alır, aynı anda tek istek gider (429 yememek için).
 * - Rate limit yerse Discord'un verdiği süre kadar bekleyip tekrar dener.
 * - Gönderilen her metin logger.redact'ten geçer: token webhook'a sızamaz.
 */
class WebhookClient {
  constructor(url = config.webhookUrl) {
    this.url = url;
    this.queue = [];
    this.running = false;
    this.maxRetries = 3;
  }

  get enabled() {
    return Boolean(this.url);
  }

  /** Ham payload gönderir. Webhook tanımlı değilse sessizce yok sayar. */
  send(payload) {
    if (!this.enabled) return Promise.resolve(false);

    return new Promise((resolve) => {
      this.queue.push({ payload: this.#prepare(payload), resolve });
      this.#drain();
    });
  }

  /** Düz metin mesajı. */
  text(content) {
    return this.send({ content: String(content).slice(0, 2000) });
  }

  /**
   * Embed mesajı.
   * @param {{title?:string, description?:string, color?:number, fields?:Array, footer?:string}} options
   */
  embed({ title, description, color = 0x5865f2, fields = [], footer } = {}) {
    const embed = { color, timestamp: new Date().toISOString() };

    if (title) embed.title = String(title).slice(0, 256);
    if (description) embed.description = String(description).slice(0, 4096);
    if (footer) embed.footer = { text: String(footer).slice(0, 2048) };
    if (fields.length) {
      embed.fields = fields.slice(0, 25).map((field) => ({
        name: String(field.name).slice(0, 256),
        value: String(field.value).slice(0, 1024) || '—',
        inline: Boolean(field.inline),
      }));
    }

    return this.send({ embeds: [embed] });
  }

  /** Hata bildirimi (kırmızı embed). */
  error(title, err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    return this.embed({
      title: `❌ ${title}`,
      description: `\`\`\`\n${detail.slice(0, 3900)}\n\`\`\``,
      color: 0xed4245,
    });
  }

  /** Payload'a kimlik bilgilerini ekler ve hassas metinleri maskeler. */
  #prepare(payload) {
    const prepared = {
      username: config.webhook.username,
      ...payload,
    };

    if (config.webhook.avatarUrl) prepared.avatar_url = config.webhook.avatarUrl;
    if (prepared.content) prepared.content = logger.redact(prepared.content);

    if (Array.isArray(prepared.embeds)) {
      prepared.embeds = prepared.embeds.map((embed) => ({
        ...embed,
        title: embed.title ? logger.redact(embed.title) : undefined,
        description: embed.description ? logger.redact(embed.description) : undefined,
        fields: embed.fields?.map((field) => ({
          ...field,
          value: logger.redact(field.value),
        })),
      }));
    }

    // Ping atmasın
    prepared.allowed_mentions = { parse: [] };
    return prepared;
  }

  /** Sırayı teker teker işler. */
  async #drain() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length) {
      const job = this.queue.shift();
      let ok = false;

      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        try {
          const res = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job.payload),
          });

          if (res.status === 429) {
            const body = await res.json().catch(() => ({}));
            const waitMs = Math.ceil((body.retry_after ?? 1) * 1000);
            logger.debug(`[webhook] rate limit, ${waitMs}ms bekleniyor`);
            await sleep(waitMs);
            continue;
          }

          if (res.status === 404 || res.status === 401) {
            logger.warn('[webhook] Webhook bulunamadı veya silinmiş, gönderim kapatılıyor.');
            this.url = '';
            break;
          }

          if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
          }

          ok = true;
          break;
        } catch (err) {
          if (attempt === this.maxRetries) {
            logger.warn(`[webhook] Gönderilemedi: ${err.message}`);
          } else {
            await sleep(500 * 2 ** attempt);
          }
        }
      }

      job.resolve(ok);
    }

    this.running = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = new WebhookClient();
module.exports.WebhookClient = WebhookClient;
