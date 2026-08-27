import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { handleMessage } from './handlers/messageHandler.js';

export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
  });

  client.on(Events.ClientReady, (readyClient) => {
    console.log(`🤖 Caduceus bot logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    await handleMessage(message, client);
  });

  return client;
}
