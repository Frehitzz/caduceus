# Caduceus — Discord Personal Assistant Bot

Caduceus is a capture → organize → daily digest Discord assistant bot built with Node.js, TypeScript, discord.js v14, Supabase (PostgreSQL), Groq (Llama 3.3 70B), and Gemini 2.5 Flash fallback.

## 🚀 Features

- **Raw Thought Capture**: Type natural text in Discord (e.g. plans, exams, internship logs).
- **AI Classification**: Powered by Groq (Llama 3.3 70B) with automatic fallback to Gemini 2.5 Flash.
- **Relational Storage**: Stores categorized items in Supabase tables (`events`, `exams`, `internship_logs`, `reminders_sent`).
- **Channel Routing & Feedback**: Reacts with status emojis and replies with structured confirmation embeds (with optional dedicated routing channels).
- **Automated Daily Digest**: Scheduled daily via `node-cron` in `Asia/Manila` timezone to `#general`, surfacing upcoming exams with urgency countdowns, scheduled plans, and recent internship logs.
- **Manual Trigger**: Send `!digest` or `caduceus digest` in any channel to view the current digest on demand.

---

## 🛠️ Setup Instructions

### 1. Database Setup (Supabase)
Run the SQL script located in [`schema.sql`](file:///C:/Mycodes/Caduceus/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard). This creates the following tables:
- `events`
- `exams`
- `internship_logs`
- `reminders_sent`

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
- `DISCORD_TOKEN`: Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications)).
- `DISCORD_GENERAL_CHANNEL_ID`: Channel ID where the daily digest will be posted.
- `SUPABASE_URL` & `SUPABASE_KEY`: From Supabase project settings.
- `GROQ_API_KEY`: API key from [Groq Console](https://console.groq.com).
- `GEMINI_API_KEY`: API key from [Google AI Studio](https://aistudio.google.com).
- `TIMEZONE`: `Asia/Manila` (default).
- `DIGEST_CRON`: `0 8 * * *` (8:00 AM Manila time).

### 3. Discord Bot Gateway Intents
In the [Discord Developer Portal](https://discord.com/developers/applications) under your bot's **Bot** tab, ensure **Privileged Gateway Intents** are enabled:
- **Message Content Intent** (Required to read raw capture messages)
- **Server Members Intent**

### 4. Running the Bot
- **Development mode (hot reload)**:
  ```bash
  npm run dev
  ```
- **Typecheck**:
  ```bash
  npm run typecheck
  ```
- **Production Build**:
  ```bash
  npm run build
  npm start
  ```
