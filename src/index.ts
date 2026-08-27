import { config } from './config/env.js';
import { createBotClient } from './bot/client.js';
import { initializeScheduler } from './services/scheduler.js';

async function bootstrap() {
  console.log('🚀 Starting Caduceus Discord Bot...');
  console.log(`📍 Timezone: ${config.TIMEZONE}`);
  console.log(`⏰ Daily Digest Cron: ${config.DIGEST_CRON}`);
  console.log(`🧠 AI Primary: Groq (${config.GROQ_MODEL})`);
  if (config.GEMINI_API_KEY) {
    console.log(`🧠 AI Fallback: Gemini (${config.GEMINI_MODEL})`);
  }

  const client = createBotClient();

  // Initialize cron job
  initializeScheduler(client);

  // Login to Discord
  await client.login(config.DISCORD_TOKEN);
}

bootstrap().catch((error) => {
  console.error('💥 Fatal error starting Caduceus:', error);
  process.exit(1);
});
