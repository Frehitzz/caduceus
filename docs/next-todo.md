The setup for **Caduceus** is complete according to the specifications in [`AGENTS.md`](file:///C:/Mycodes/Caduceus/AGENTS.md).

### 🛠️ What was configured and built:

1. **Project Dependencies & TypeScript Setup**:
   - Installed `discord.js` (v14), `@supabase/supabase-js`, `groq-sdk`, `@google/genai`, `zod`, `node-cron`, `luxon`, and `dotenv`.
   - Configured [`tsconfig.json`](file:///C:/Mycodes/Caduceus/tsconfig.json) and [`package.json`](file:///C:/Mycodes/Caduceus/package.json) for ES modules with `dev`, `build`, `typecheck`, and `start` scripts.

2. **Database Schema**:
   - Created [`schema.sql`](file:///C:/Mycodes/Caduceus/schema.sql) defining tables for `events`, `exams`, `internship_logs`, and `reminders_sent`, with indexes for user and date queries.

3. **Core Services & Architecture**:
   - **Environment Loader**: [`src/config/env.ts`](file:///C:/Mycodes/Caduceus/src/config/env.ts) validates all keys and timezone configs using Zod.
   - **Supabase Client & Models**: [`src/db/client.ts`](file:///C:/Mycodes/Caduceus/src/db/client.ts) and [`src/db/types.ts`](file:///C:/Mycodes/Caduceus/src/db/types.ts).
   - **AI Classifier**: [`src/services/classifier.ts`](file:///C:/Mycodes/Caduceus/src/services/classifier.ts) classifies messages using **Groq** (primary: Llama 3.3 70B) with automatic fallback to **Gemini 2.5 Flash**, returning structured JSON validated by Zod.
   - **Database Operations**: [`src/services/database.ts`](file:///C:/Mycodes/Caduceus/src/services/database.ts) handles inserts and upcoming queries for exams, plans, and internship work notes.
   - **Daily Digest Engine**: [`src/services/digest.ts`](file:///C:/Mycodes/Caduceus/src/services/digest.ts) aggregates upcoming exams (with urgency tags `TODAY`, `TOMORROW`, countdowns), weekly events, and internship logs into a clean Discord embed.
   - **Timezone Scheduler**: [`src/services/scheduler.ts`](file:///C:/Mycodes/Caduceus/src/services/scheduler.ts) triggers the daily morning digest in `Asia/Manila` time.
   - **Discord Client & Handlers**: [`src/bot/client.ts`](file:///C:/Mycodes/Caduceus/src/bot/client.ts) and [`src/bot/handlers/messageHandler.ts`](file:///C:/Mycodes/Caduceus/src/bot/handlers/messageHandler.ts) process incoming messages, react with emojis, route confirmations, and support the `!digest` manual trigger command.

---

### 📋 Next Steps to Run:

1. **Create Supabase Tables**:
   Copy the contents of [`schema.sql`](file:///C:/Mycodes/Caduceus/schema.sql) and execute it in your **[Supabase SQL Editor](https://supabase.com/dashboard)**.

2. **Configure your `.env`**:
   Create a `.env` file from [`.env.example`](file:///C:/Mycodes/Caduceus/.env.example) and provide your keys:
   ```bash
   cp .env.example .env
   ```

3. **Discord Gateway Intents**:
   In the **[Discord Developer Portal](https://discord.com/developers/applications)** under your bot's **Bot** settings, enable **Privileged Gateway Intents** (`Message Content Intent`).

4. **Start the Bot**:
   ```powershell
   npm run dev
   ```