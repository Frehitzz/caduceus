import cron from 'node-cron';
import type { Client } from 'discord.js';
import { config } from '../config/env.js';
import { sendDailyDigest } from './digest.js';

export function initializeScheduler(client: Client): void {
  console.log(`⏰ Initializing daily digest scheduler with cron pattern "${config.DIGEST_CRON}" in timezone "${config.TIMEZONE}"...`);

  cron.schedule(
    config.DIGEST_CRON,
    async () => {
      console.log('⏰ Running scheduled daily digest job...');
      await sendDailyDigest(client);
    },
    {
      timezone: config.TIMEZONE,
    }
  );

  console.log('✅ Daily digest scheduler active.');
}
