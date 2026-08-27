# Feature 1: Task Completion & Deletion (`complete` / `delete` Intent)

**Branch name:** `feat/complete-delete-intent`  
**Effort:** ~1.5 hrs  
**Priority:** 🎯 Phase 1 — High Priority  

---

## Problem

Currently, once you record a task or exam, there is no natural way to mark it as done or remove it if plans change. Completed exams and cancelled plans stay in your list forever, cluttering query results and the daily digest.

---

## How It Works

Fritz types natural text like:
- `"done with networks exam"`
- `"completed buying flowers"`
- `"finished the Rizal reflection"`
- `"cancel the 2x2 picture plan"`
- `"remove networks exam"`
- `"delete buying flowers"`

Caduceus classifies it as `complete` or `delete`, fuzzy-matches the item in Supabase, and either marks it done or removes it entirely.

---

## Implementation Steps

### Step 1 — Database Migration

Add `is_completed` and `completed_at` columns to `events` and `exams`.

Create `migrations/002_add_completion_columns.sql`:

```sql
-- Add completion tracking to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add completion tracking to exams
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for filtering active (non-completed) items efficiently
CREATE INDEX IF NOT EXISTS idx_events_active ON events(user_id, is_completed, event_date);
CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(user_id, is_completed, exam_date);
```

Run this in **Supabase SQL Editor**. Also update `schema.sql` to include these columns in the canonical schema.

---

### Step 2 — Update TypeScript Types

In `src/db/types.ts`, add to both `EventRecord` and `ExamRecord`:

```typescript
is_completed?: boolean;
completed_at?: string | null;
```

---

### Step 3 — Update Classifier

In `src/services/classifier.ts`:

1. **Add `'complete'` and `'delete'` to the category enum:**
   ```typescript
   z.enum(['plan', 'exam', 'internship_log', 'query', 'complete', 'delete', 'other'])
   ```

2. **Add a new field to the Zod schema:**
   ```typescript
   target_description: z.preprocess(
     (val) => (val == null ? '' : String(val)),
     z.string()
   ),
   ```
   This field holds the LLM's extracted description of the item being completed/deleted (e.g., `"networks exam"`, `"buying flowers"`).

3. **Update the `buildPrompt()` function** to add two new classifier categories:
   ```
   6. "complete": When the user says they have finished, completed, or done with
      a previously recorded task, exam, or plan.
      Examples: "done with networks exam", "completed buying flowers",
      "finished the Rizal reflection".

   7. "delete": When the user wants to cancel, remove, or delete a previously
      recorded task, exam, or plan.
      Examples: "cancel the 2x2 picture plan", "remove networks exam",
      "delete buying flowers".

   - For both "complete" and "delete", set "target_description" to a short phrase
     identifying the item (e.g., "Networks exam", "buy flowers plan").
   - Set isActionable to true.
   ```

---

### Step 4 — Add Database Helpers

In `src/services/database.ts`, add these functions:

```typescript
// Mark an event as completed by fuzzy-matching raw_text
export async function completeEvent(
  userId: string,
  targetDescription: string
): Promise<EventRecord | null>

// Mark an exam as completed by fuzzy-matching subject
export async function completeExam(
  userId: string,
  targetDescription: string
): Promise<ExamRecord | null>

// Hard-delete an event row
export async function deleteEvent(
  userId: string,
  targetDescription: string
): Promise<boolean>

// Hard-delete an exam row
export async function deleteExam(
  userId: string,
  targetDescription: string
): Promise<boolean>
```

**Matching strategy:**
1. Query all active (`is_completed = false`) items for the user.
2. Use case-insensitive `ILIKE '%keyword%'` on `raw_text` (events) or `subject` (exams).
3. If multiple matches, pick the one with the nearest `event_date` / `exam_date`.

For completion:
```sql
UPDATE events SET is_completed = true, completed_at = now()
WHERE id = '<matched_id>';
```

---

### Step 5 — Update Existing Queries to Exclude Completed Items

In `src/services/database.ts`, update **all** `query*` and `getUpcoming*` functions to add:

```typescript
query = query.eq('is_completed', false);
```

This ensures completed tasks no longer appear in:
- List query results (`"show me all my todos"`)
- The daily morning digest

---

### Step 6 — Wire Into Message Handler

In `src/bot/handlers/messageHandler.ts`, add new branches after the `query` handler:

```typescript
if (classification.category === 'complete') {
  // Try completing in both events and exams tables using target_description
  // Reply with ✅ confirmation embed showing what was marked done
  // Or "couldn't find that item" message if no match
}

if (classification.category === 'delete') {
  // Try deleting from both events and exams tables using target_description
  // Reply with 🗑️ confirmation embed showing what was removed
  // Or "couldn't find that item" message if no match
}
```

---

## Files Touched

| File | Change |
|---|---|
| `schema.sql` | Add `is_completed`, `completed_at` columns + indexes |
| `migrations/002_add_completion_columns.sql` | New migration file |
| `src/db/types.ts` | Add `is_completed`, `completed_at` to interfaces |
| `src/services/classifier.ts` | Add `complete`, `delete` categories + `target_description` field |
| `src/services/database.ts` | Add `completeEvent`, `completeExam`, `deleteEvent`, `deleteExam` + filter active items |
| `src/bot/handlers/messageHandler.ts` | Route `complete` and `delete` intents |
| `src/services/queryHandler.ts` | Ensure completed items are excluded from list embeds |
| `src/services/digest.ts` | Ensure completed items are excluded from morning digest |

---

## Acceptance Check

- [ ] `"done with networks exam"` → finds the Networks exam, marks it completed, replies with ✅ embed.
- [ ] `"cancel the 2x2 picture plan"` → deletes the matching event row, replies with 🗑️ confirmation.
- [ ] `"show me all my todos"` → no longer shows completed items.
- [ ] Daily morning digest → excludes completed exams/events.
- [ ] If no match found → replies with `"Couldn't find a matching item to complete/delete."`.
