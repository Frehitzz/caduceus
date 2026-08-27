# Feature 2: Weekly Internship Report Generator (`weekly_report` Intent)

**Branch name:** `feat/weekly-report-generator`  
**Effort:** ~1.5 hrs  
**Priority:** 🎯 Phase 1 — High Priority  

---

## Problem

Fritz logs day-to-day work for the Banh Mi Kitchen LMS project (SharePoint → real LMS conversion with quiz-gating logic), but at the end of each week he still has to manually assemble his weekly OJT/Internship Accomplishment Report. Caduceus already stores these logs — it should be able to compile them automatically.

---

## How It Works

Fritz types natural text like:
- `"generate my weekly internship report"`
- `"summarize my OJT logs for this week"`
- `"compile my weekly report"`
- `"what did I do this week at internship"`

Caduceus pulls the week's `internship_logs` from Supabase, sends them to the LLM to format into a clean professional report, and replies with both a Discord embed and a copy-paste-ready plain-text version.

---

## Implementation Steps

### Step 1 — Update Classifier

In `src/services/classifier.ts`:

1. **Add `'weekly_report'` to the category enum:**
   ```typescript
   z.enum([..., 'weekly_report', ...])
   ```

2. **Update `buildPrompt()`** to add:
   ```
   8. "weekly_report": When the user asks to generate, summarize, or compile their
      weekly internship/OJT report.
      Examples: "generate my weekly internship report",
      "summarize my OJT logs for this week", "compile my weekly report",
      "what did I do this week at internship".
      Set isActionable to true.
   ```

---

### Step 2 — Create Report Generator Service

Create a new file `src/services/reportGenerator.ts`:

```typescript
export async function generateWeeklyReport(
  userId: string | undefined,
  username?: string
): Promise<{ embed: EmbedBuilder; reportText: string }>
```

**Logic:**

1. Query `internship_logs` for the past 7 days using the existing `queryInternshipLogs({ userId, filter: 'this_week' })`.

2. If no logs found, throw/return an error message:
   `"No internship logs found for this week. Log some work first!"`

3. Concatenate all log entries into a single string with dates.

4. Send to the LLM (Groq primary, Gemini fallback) with this prompt:

```
You are Caduceus, generating a professional Weekly Accomplishment Report
for Fritz's OJT/Internship at Banh Mi Kitchen Services Inc.

Fritz is building an LMS website (converting SharePoint L&D content)
with quiz-gating logic.

Given the following raw daily work logs from this week, generate a clean
formatted report with these sections:
1. 🚀 Completed Features & Improvements
2. 🐛 Bug Fixes & Maintenance
3. 📝 Learnings & Notes
4. 🎯 Next Week's Focus (infer from context)

Keep it professional but concise. Use bullet points.
Output ONLY the report text, no JSON.

Raw logs:
"""
[Aug 25] Fixed the quiz gating bug on Module 3
[Aug 26] Added progress tracking to the LMS dashboard
[Aug 27] Migrated SharePoint content for HR onboarding module
"""
```

5. Parse the LLM response and build a Discord embed with each section as a field.

6. Also return the raw plain-text version in `reportText` so Fritz can copy-paste it into his actual OJT submission.

---

### Step 3 — Wire Into Message Handler

In `src/bot/handlers/messageHandler.ts`, add a branch:

```typescript
if (classification.category === 'weekly_report') {
  try {
    const report = await generateWeeklyReport(userId, message.author.username);

    // React with 📄
    await message.react('📄').catch(() => null);

    // Send embed
    await message.reply({ embeds: [report.embed] });

    // Send plain-text version in a code block for easy copy-paste
    await message.reply(
      `**📋 Copy-paste version:**\n\`\`\`\n${report.reportText}\n\`\`\``
    );
  } catch (error) {
    await message.reply('📝 No internship logs found for this week. Log some work first!');
  }
  return;
}
```

---

### Step 4 — Report Embed Design

The embed should look like:

```
📄 Weekly OJT Report — Aug 21–27, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Completed Features & Improvements
• Migrated SharePoint HR onboarding content to LMS
• Added progress tracking dashboard for learners

🐛 Bug Fixes & Maintenance
• Fixed quiz gating bug on Module 3
• Resolved session timeout issue on login page

📝 Learnings & Notes
• Explored React component lifecycle for quiz timer
• Studied SharePoint REST API for batch content migration

🎯 Next Week's Focus
• Complete Module 4 content migration
• Implement certificate generation for completed courses

Footer: Generated for Fritz • Banh Mi Kitchen Services Inc. • Asia/Manila
```

---

## Files Touched

| File | Change |
|---|---|
| `src/services/classifier.ts` | Add `weekly_report` category to enum + prompt |
| `src/services/reportGenerator.ts` | **New file** — LLM-powered report generation |
| `src/bot/handlers/messageHandler.ts` | Route `weekly_report` intent |

---

## Acceptance Check

- [ ] `"generate my weekly internship report"` → pulls this week's logs, sends formatted report embed.
- [ ] `"summarize my OJT logs for this week"` → same behavior.
- [ ] If no logs exist for the week → replies with a helpful message instead of an empty report.
- [ ] The plain-text code block version is copy-paste ready for Fritz's actual OJT report submission.
- [ ] Report sections are cleanly separated (Features, Bug Fixes, Learnings, Next Week's Focus).
