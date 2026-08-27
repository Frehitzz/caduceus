# Feature 6: Urgent Exam Study Countdown in Morning Digest

**Branch name:** `feat/exam-study-countdown`  
**Effort:** ~45 mins  
**Priority:** 🔮 Phase 3 — Future Polish  

---

## Problem

The current morning digest treats all exams equally — an exam 7 days out looks the same as one happening tomorrow. When an exam is ≤ 3 days away, it needs a dedicated, impossible-to-miss **🔥 URGENT EXAM ALERT** section with a countdown timer at the very top of the digest.

---

## How It Works

1. Every morning at 8:00 AM (existing digest cron), Caduceus checks for exams within the next 3 days.
2. If any are found, the digest embed gets:
   - A **red side border** (`#ed4245`) instead of the calm blurple.
   - A **🔥 URGENT EXAM ALERT** field at the very top of the embed (before Plans & Events).
   - A countdown showing exact hours or days remaining.
3. Example output in the digest:
   ```
   🔥 URGENT EXAM ALERT
   🔥 Networks — ⏰ 18 hours left — Focus on studying today!
   🔥 Database Systems — ⏰ 2 days left — Focus on studying today!
   ```

---

## Implementation Steps

### Step 1 — Update Digest Embed Generator

In `src/services/digest.ts`, update the `generateDigestEmbed()` function:

1. **Filter urgent exams (≤ 3 days away):**

```typescript
const urgentExams = exams.filter((exam) => {
  const examDate = DateTime.fromISO(exam.exam_date, { zone: config.TIMEZONE });
  const diffDays = Math.round(
    examDate.startOf('day').diff(now.startOf('day'), 'days').days
  );
  return diffDays >= 0 && diffDays <= 3;
});
```

2. **Add 🔥 URGENT field at the top of the embed** (before all other fields):

```typescript
if (urgentExams.length > 0) {
  const urgentLines = urgentExams.map((exam) => {
    const examDate = DateTime.fromISO(exam.exam_date, { zone: config.TIMEZONE });
    const diffHours = Math.round(examDate.diff(now, 'hours').hours);

    let countdown = '';
    if (diffHours <= 0) {
      countdown = '🚨 RIGHT NOW';
    } else if (diffHours <= 24) {
      countdown = `⏰ ${diffHours} hours left`;
    } else {
      const diffDays = Math.ceil(diffHours / 24);
      countdown = `⏰ ${diffDays} day${diffDays > 1 ? 's' : ''} left`;
    }

    return `🔥 **${exam.subject}** — ${countdown} — Focus on studying today!`;
  });

  embed.addFields({
    name: '🔥 URGENT EXAM ALERT',
    value: urgentLines.join('\n'),
    inline: false,
  });
}
```

3. **Change embed side color to red** when urgent:

```typescript
const hasUrgentExam = urgentExams.length > 0;
embed.setColor(hasUrgentExam ? 0xed4245 : 0x5865f2);
```

---

### Step 2 — (Optional) LLM-Powered Study Focus Hint

For extra polish, pass each urgent exam's subject to the LLM and ask for a 1-line study suggestion:

```
Given that Fritz has an exam in "${subject}" in ${diffDays} days,
suggest one specific study focus area in 10 words or less.
Example: "Review subnetting and OSI model layers"
```

Append the hint to the urgent line:
```
🔥 **Networks** — ⏰ 2 days left — *Review subnetting and OSI model layers*
```

> **Note:** This LLM call is optional and adds latency to the morning digest. Consider:
> - Caching study hints (one LLM call per exam, not per digest run).
> - Skipping if Groq rate limits are tight in the morning.
> - Making it a config toggle (`STUDY_HINTS_ENABLED=true`).

---

### Step 3 — Ensure Non-Urgent Exams Still Appear Normally

Exams further than 3 days away should still appear in the regular `📚 Exams & Academic Deadlines` section below the urgent alert. The urgent section is additive, not a replacement.

---

## Files Touched

| File | Change |
|---|---|
| `src/services/digest.ts` | Add urgent exam detection, 🔥 field, red color logic |

---

## Acceptance Check

- [ ] When an exam is **3 days or fewer** away, the morning digest shows a **red-bordered** embed with a `🔥 URGENT EXAM ALERT` section at the **top**.
- [ ] The countdown shows **hours** (if < 24h) or **days** remaining.
- [ ] Exams **further than 3 days** away still appear normally in the regular exam section below.
- [ ] When **no exams** are within 3 days, the digest looks exactly as before (blurple border, no alert section).
- [ ] The `Good morning!` digest message is unchanged — only the embed styling adapts.
