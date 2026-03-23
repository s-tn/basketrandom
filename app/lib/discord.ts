import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';

let client: Client | null = null;
let ready = false;

export function initDiscord() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.log('DISCORD_TOKEN not set, skipping Discord bot');
    return;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once('ready', () => {
    ready = true;
    console.log(`Discord bot logged in as ${client!.user?.tag}`);
  });

  client.login(token).catch((err) => {
    console.warn('Discord login failed:', err.message);
    client = null;
  });
}

export async function notify(event: string, data: Record<string, any>) {
  if (!client || !ready) return;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder().setColor(0xFF6B35).setTimestamp();

    switch (event) {
      case 'room_created':
        embed.setTitle('New Room').setDescription(`**${data.host}** created room **${data.name}**`);
        break;
      case 'match_started':
        embed.setTitle('Match Started').setDescription(`**${data.p0}** vs **${data.p1}**`);
        break;
      case 'match_ended':
        embed.setTitle('Match Ended').setDescription(`**${data.winner}** wins! Final: ${data.score}`);
        break;
      case 'tournament_created':
        embed.setTitle('Tournament Open').setDescription(`**${data.name}** — ${data.format}, ${data.maxPlayers} slots`);
        break;
      case 'tournament_winner':
        embed.setTitle('Tournament Champion').setDescription(`**${data.winner}** wins **${data.name}**!`);
        break;
      default:
        embed.setDescription(JSON.stringify(data));
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Discord notification failed:', err);
  }
}

export function getDiscordClient() { return client; }
