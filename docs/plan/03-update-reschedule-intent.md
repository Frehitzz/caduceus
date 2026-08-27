# Feature 3: Date Updating & Rescheduling (`update` Intent)

**Branch name:** `feat/update-reschedule-intent`  
**Effort:** ~1.5 hrs  
**Priority:** 🎯 Phase 1 — High Priority  

---

## Problem

Professors move exam dates and personal plans get postponed. Currently there is no way to update an existing record — Fritz would have to delete the old one and re-create it manually. A natural `"Networks exam was moved to Sept 12"` should just update the existing row.

---

## How It Works

Fritz types natural text like:
- `"Networks exam was moved to Sept 12"`
- `"delay buying flowers to Saturday"`
- `"update the Rizal reflection deadline to next Monday"`
- `"OJT presentation rescheduled to Sept 3"`

Caduceus classifies it as `update`, extracts the target item and new date, fuzzy-matches the existing record in Supabase, and updates the `event_date` / `exam_date` in place.

---

## Implementation Steps

### Step 1 — Update Classifier

In `src/services/classifier.ts`:

1. **Add `'update'` to the category enum:**
   ```typescript
   z.enum([..., 'update', ...])
   ```

2. **Add new schema fields:**
   ```typescript
   target_description: z.preprocess(
     (val) => (val == null ? '' : String(val)),
     z.string()
   ),
   new_date: z.preprocess(
     (val) => (val == null || val === '' ? null : String(val)),
     z.string().nullable()
   ).default(null),
   ```

   > Note: `target_description` may already exist from Feature 1 (complete/delete). If so, just add `new_date`.

3. **Update `buildPrompt()`** to add:
   ```
   9. "update": When the user says an existing task, exam, or plan has been
      rescheduled, moved, delayed, postponed, or its details changed.
      Examples: "Networks exam was moved to Sept 12",
      "delay buying flowers to Saturday",
      "update the Rizal reflection deadline to next Monday".
      Set "target_description" to the item being updated.
      Set "new_date" to the resolved new ISO-8601 date.
      Set "notes" to any updated notes if mentioned.
      Set isActionable to true.
   ```

---

### Step 2 — Add Database Helpers

In `src/services/database.ts`, add:

```typescript
// Update event date by fuzzy-matching raw_text
export async function updateEventDate(
  userId: string,
  targetDescription: string,
  newDate: string,
  newNotes?: string | null
): Promise<EventRecord | null>

// Update exam date by fuzzy-matching subject
export async function updateExamDate(
  userId: string,
  targetDescription: string,
  newDate: string,
  newNotes?: string | null
): Promise<ExamRecord | null>
```

**Matching strategy:**
1. Same fuzzy `ILIKE` approach as Feature 1 (complete/delete).
2. Query all active items for the user where `raw_text` or `subject` matches the `target_description`.
3. If multiple matches, pick the one with the nearest existing date.
4. Update the matched row:

```sql
-- For events:
UPDATE events SET event_date = '<new_date>', notes = '<new_notes>'
WHERE id = '<matched_id>';

-- For exams:
UPDATE exams SET exam_date = '<new_date>', notes = '<new_notes>'
WHERE id = '<matched_id>';
```

---

### Step 3 — Wire Into Message Handler

In `src/bot/handlers/messageHandler.ts`, add a branch:

```typescript
if (classification.category === 'update') {
  const targetDesc = classification.target_description;
  const newDate = classification.new_date;

  if (!newDate) {
    await message.reply("⚠️ I couldn't determine the new date. Please include a date.");
    return;
  }

  // Try updating in exams first (more specific), then events
  let updated = await updateExamDate(userId, targetDesc, newDate, classification.notes);
  let tableName = 'exam';

  if (!updated) {
    updated = await updateEventDate(userId, targetDesc, newDate, classification.notes);
    tableName = 'plan';
  }

  if (updated) {
    const confirmEmbed = new EmbedBuilder()
      .setTitle('📝 Item Rescheduled')
      .setColor(0x3498db) // Blue
      .addFields(
        { name: 'Item', value: targetDesc, inline: true },
        { name: 'New Date', value: newDate, inline: true },
      )
      .setFooter({ text: `Updated for ${message.author.username}` });

    await message.react('📝').catch(() => null);
    await message.reply({ embeds: [confirmEmbed] });
  } else {
    await message.reply("⚠️ Couldn't find a matching item to update.");
  }
}
```

**Confirmation embed should show:**
- Item name / description
- New date
- Updated notes (if any)

---

## Files Touched

| File | Change |
|---|---|
| `src/services/classifier.ts` | Add `update` category + `target_description`, `new_date` fields |
| `src/services/database.ts` | Add `updateEventDate`, `updateExamDate` functions |
| `src/bot/handlers/messageHandler.ts` | Route `update` intent with confirmation embed |

---

## Acceptance Check

- [ ] `"Networks exam was moved to Sept 12"` → finds the Networks exam, updates `exam_date` to `2026-09-12`, replies with 📝 confirmation.
- [ ] `"delay buying flowers to Saturday"` → updates the event date, replies with confirmation.
- [ ] `"update the Rizal reflection deadline to next Monday"` → updates correctly with resolved date.
- [ ] If no matching item found → replies with `"Couldn't find a matching item to update."`.
- [ ] If no new date detected → replies with `"I couldn't determine the new date."`.
