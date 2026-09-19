'use strict';

const { config } = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

/** Log satırlarına token/webhook gibi gizli bilgiler sızmasın diye maskeler. */
function redact(input) {
  let text = typeof input === 'string' ? input : String(input);

  if (config.token) text = text.split(config.token).join('[TOKEN GİZLENDİ]');
  if (config.webhookUrl) text = text.split(config.webhookUrl).join('[WEBHOOK GİZLENDİ]');

  // Elde kalan webhook adreslerini de temizle
  text = text.replace(
    /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi,
    '[WEBHOOK GİZLENDİ]',
  );

  return text;
}

function timestamp() {
  return new Date().toLocaleTimeString('tr-TR', { hour12: false });
}

function write(level, args) {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;

  const parts = args.map((arg) => {
    if (arg instanceof Error) return redact(arg.stack ?? arg.message);
    if (typeof arg === 'object' && arg !== null) {
      try {
        return redact(JSON.stringify(arg));
      } catch {
        return redact(String(arg));
      }
    }
    return redact(arg);
  });

  const prefix = `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS[level]}${level.toUpperCase().padEnd(5)}${COLORS.reset}`;
  const stream = level === 'error' ? console.error : console.log;
  stream(prefix, ...parts);
}

module.exports = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  redact,
};
