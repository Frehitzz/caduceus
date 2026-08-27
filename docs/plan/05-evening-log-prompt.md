# Feature 5: Evening OJT Work Log Prompt (Optional Cron)

**Branch name:** `feat/evening-log-prompt`  
**Effort:** ~30 mins  
**Priority:** ⚡ Phase 2 — Medium Priority  

---

## Problem

Fritz sometimes forgets to log his daily internship work at Banh Mi Kitchen. A gentle evening reminder nudge in Discord would build a consistent logging habit, making the Weekly Report Generator (Feature 2) more useful since it has more data to work with.

---

## How It Works

1. At **6:00 PM Manila time, Monday–Friday**, Caduceus automatically sends a message to `#internship-logs` (or `#general` if no dedicated channel):
   > *"Hey Fritz 👋 Happy Wednesday! What did you work on at Banh Mi Kitchen today?"*
   > *"Just type what you did and I'll log it for you."*

2. Fritz replies with raw text → the existing `internship_log` classifier picks it up and logs it normally.

3. Does **not** fire on weekends.

4. Can be disabled by clearing `LOG_PROMPT_CRON` in `.env`.

---

## Implementation Steps

### Step 1 — Add Environment Variable

In `src/config/env.ts`, add to the Zod schema:

```typescript
LOG_PROMPT_CRON: z.string().default('0 18 * * 1-5'),  // 6 PM Manila, Mon-Fri
```

Also add to `.env.example`:
```env
# Evening OJT log prompt (Mon-Fri 6PM Manila). Set to empty string to disable.
LOG_PROMPT_CRON=0 18 * * 1-5
```

---

### Step 2 — Create Prompt Function

Create a new file `src/services/logPrompt.ts` (or add to `digest.ts`):

```typescript
import { Client, TextChannel } from 'discord.js';
import { DateTime } from 'luxon';
import { config } from '../config/env.js';

export async function sendEveningLogPrompt(client: Client): Promise<void> {
  try {
    const channelId =
      config.DISCORD_INTERNSHIP_CHANNEL_ID || config.DISCORD_GENERAL_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      console.error('❌ Log prompt channel not found.');
      return;
    }

    const now = DateTime.now().setZone(config.TIMEZONE);
    const dayName = now.toFormat('EEEE');

    await channel.send(
      `Hey Fritz 👋 Happy ${dayName}! What did you work on at Banh Mi Kitchen today?\n` +
      `_Just type what you did and I'll log it for you._`
    );

    console.log('✅ Evening OJT log prompt sent.');
  } catch (error) {
    console.error('❌ Failed to send evening log prompt:', error);
  }
}
```

---

### Step 3 — Register the Cron Job

In `src/services/scheduler.ts`, add a second `cron.schedule()` call:

```typescript
import { sendEveningLogPrompt } from './logPrompt.js';

// Inside initializeScheduler():
if (config.LOG_PROMPT_CRON) {
  cron.schedule(
    config.LOG_PROMPT_CRON,
    async () => {
      console.log('💼 Running evening OJT log prompt...');
      await sendEveningLogPrompt(client);
    },
    { timezone: config.TIMEZONE }
  );
  console.log(
    `✅ Evening OJT log prompt scheduler active ` +
    `(cron: "${config.LOG_PROMPT_CRON}", timezone: "${config.TIMEZONE}").`
  );
}
```

---

## Files Touched

| File | Change |
|---|---|
| `src/config/env.ts` | Add `LOG_PROMPT_CRON` env variable |
| `.env.example` | Add `LOG_PROMPT_CRON` example |
| `src/services/logPrompt.ts` | **New file** — sends evening prompt message |
| `src/services/scheduler.ts` | Register second cron job for evening prompt |

---

## Acceptance Check

- [ ] At 6:00 PM Manila time on a weekday, Caduceus sends: `"Hey Fritz 👋 Happy Wednesday! What did you work on at Banh Mi Kitchen today?"` to the configured channel.
- [ ] Fritz replies with raw text → existing `internship_log` classifier picks it up and logs it normally.
- [ ] Does **not** fire on Saturday or Sunday.
- [ ] Can be disabled by setting `LOG_PROMPT_CRON=` (empty) in `.env`.
- [ ] Startup log shows: `"✅ Evening OJT log prompt scheduler active"`.
