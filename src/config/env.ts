import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GENERAL_CHANNEL_ID: z.string().min(1, 'DISCORD_GENERAL_CHANNEL_ID is required for daily digest'),
  DISCORD_PLANS_CHANNEL_ID: z.string().optional(),
  DISCORD_EXAMS_CHANNEL_ID: z.string().optional(),
  DISCORD_INTERNSHIP_CHANNEL_ID: z.string().optional(),
  ALLOWED_USER_ID: z.string().optional(),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_KEY: z.string().min(1, 'SUPABASE_KEY is required'),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  TIMEZONE: z.string().default('Asia/Manila'),
  DIGEST_CRON: z.string().default('0 8 * * *'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
