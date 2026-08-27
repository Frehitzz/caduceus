# Caduceus — Discord Personal Assistant Bot

## What we're building

A Discord bot named **Caduceus** that acts as a capture → organize → daily digest
system. Fritz types raw, unstructured messages into Discord (plans, exams,
internship work notes), Caduceus classifies and routes each into the right
place, and every morning Caduceus posts a digest to `#general` reminding Fritz
what's coming up and what to prepare for.

This is **not** a query/response chatbot. It's closer to a personal
Zapier-style routing bot: dump a thought, Caduceus files it correctly, and
surfaces it back at the right time without being asked.

## Core flow

1. Fritz types raw text into a channel or DM, e.g.:
   - "got a plan on this upcoming date, gonna buy flowers for my gf"
   - "exam in networks on Sept 5"
   - "fixed the quiz gating bug at internship today"
2. Caduceus sends the message to an LLM classifier, which determines:
   - **Category**: `plan`, `exam`, or `internship_log`
   - **Extracted date** (if relevant)
   - **Cleaned-up text**
3. Caduceus writes a row to the matching database table and posts a
   confirmation into the matching channel (e.g. plans → `#plans`).
4. Once a day (cron job), Caduceus queries for anything due today or soon
   (exams within N days, upcoming plans) and posts **one combined digest
   message** to `#general` — what's coming up, what to prepare/study.

## Scope decisions (already made)

- **Single-user for now**, but DB schema includes a `user_id` column from day
  one so it can be opened to other users later without a rewrite.
- **Manual entry only** — no calendar (Google Calendar etc.) sync in v1.
- **Quick POC first**, not a fully planned-out architecture up front.
- Target build time: ~1 day of focused work (realistically 7–10 hrs), most of
  which goes to Discord bot setup, the message-handling glue code, and the
  cron/timezone digest logic — not the AI call itself.

## Tech stack (chosen by project requirements, not by what Fritz already knows)

| Concern | Choice | Why |
|---|---|---|
| Runtime/Language | Node.js + TypeScript | discord.js is the most mature Discord bot library; TS catches malformed classifier output before runtime |
| Bot framework | discord.js v14 | Industry standard, actively maintained |
| Database | Postgres (via Supabase) | Need relational, queryable, structured data — "exams due in 3 days," "mark reminder as sent" |
| AI provider (primary) | **Groq** (OpenAI-compatible, e.g. Llama 3.3 70B) | Free tier, ~14,400 requests/day, fast |
| AI provider (fallback) | **Gemini 2.5 Flash** | Free tier, no card required, different provider = different quota pool if Groq errors/rate-limits |
| Output validation | Zod | LLM JSON output must be validated before it's trusted to write to the DB |
| Scheduling | node-cron | One daily job, no need for a heavyweight job queue; must be set to `Asia/Manila` explicitly (not UTC) |
| Hosting | Any always-on Node host (Railway, Render, Fly.io, VPS) | Discord bots hold a persistent websocket — rules out serverless/on-demand platforms |
| Secrets | `.env` + `dotenv`, gitignored | Discord token, Groq key, Gemini key, Supabase keys |

**AI provider policy**: Never use multiple accounts/API keys on the *same*
provider to bypass its free-tier rate limit — that violates most providers'
ToS. Fallback across *different* providers (Groq → Gemini) is fine and is
the intended resilience pattern here.

## Database schema (Postgres / Supabase)

```sql
-- Generic plans/events (anything not an exam or internship log)
events (
  id, user_id, category, raw_text, event_date, channel_posted, created_at
)

-- Exams to track and remind about
exams (
  id, user_id, subject, exam_date, notes, created_at
)

-- Internship work log entries (doubles as weekly report material)
internship_logs (
  id, user_id, entry_text, logged_at
)

-- Prevents duplicate reminder pings for the same exam/event
reminders_sent (
  id, exam_id, sent_at
)
```

## Context: Fritz's internship

Caduceus' internship-log feature is meant to capture day-to-day work at
**Banh Mi Kitchen Services Inc.** (Mandaluyong City), where Fritz is
converting their SharePoint-based Learning & Development content into a
real LMS website with quiz-gating logic. Internship log summaries pulled
by Caduceus can double as material for Fritz's actual internship reports.

## Cost

- Hosting: free tier (Railway/Render) is enough for this scale.
- Database: Supabase free tier (500 MB DB, 5 GB egress) is far more than
  needed for three small tables at personal-use volume.
- AI: $0 using Groq (primary) + Gemini (fallback) free tiers. If ever
  switched to Claude API instead, cost would be roughly cents/month at
  this message volume (Haiku 4.5 pricing).

## Not in scope for v1

- Calendar sync (Google Calendar etc.)
- Multi-user support (schema is ready for it, feature is not)
- Slash commands / complex command UI — plain natural-language messages only
