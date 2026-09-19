'use strict';

module.exports = {
  name: 'ping',
  aliases: ['gecikme', 'p'],
  description: 'Discord API gecikmesini ve bot çalışma süresini gösterir.',
  usage: 'ping',
  category: 'genel',

  async run({ client, message }) {
    const sent = await message.channel.send('`Ölçülüyor...`');

    const roundTrip = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);
    const uptime = formatDuration(Date.now() - client.startedAt);

    await sent.edit(
      [
        '```yaml',
        `Gidiş-dönüş : ${roundTrip}ms`,
        `API         : ${apiPing < 0 ? 'ölçülemedi' : `${apiPing}ms`}`,
        `Çalışma     : ${uptime}`,
        '```',
      ].join('\n'),
    );
  },
};

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days) parts.push(`${days}g`);
  if (hours) parts.push(`${hours}s`);
  if (minutes) parts.push(`${minutes}d`);
  parts.push(`${secs}sn`);

  return parts.join(' ');
}
