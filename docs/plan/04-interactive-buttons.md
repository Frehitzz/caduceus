# Feature 4: Interactive Discord Action Buttons

**Branch name:** `feat/interactive-buttons`  
**Effort:** ~2 hrs  
**Priority:** ⚡ Phase 2 — Medium Priority  
**Depends on:** Feature 1 (Task Completion & Deletion) — reuses the same DB completion/deletion logic.

---

## Problem

Currently, completing or deleting a task requires typing a full natural-language sentence. On mobile especially, tapping a button is far faster. When Caduceus returns a list of todos, it should attach ✅ Done and 🗑️ Delete buttons for one-tap task management.

---

## How It Works

1. Fritz types `"show me all my todos"`.
2. Caduceus returns the embed **with action buttons** attached below:
   ```
   [✅ Done: Networks Exam]  [🗑️]
   [✅ Done: Buy Flowers]    [🗑️]
   ```
3. Fritz taps ✅ → item is marked completed instantly.
4. Fritz taps 🗑️ → item is deleted instantly.
5. The bot replies with an ephemeral (only-you-can-see) confirmation and updates the buttons.

---

## Implementation Steps

### Step 1 — Update Query Handler to Attach Buttons

In `src/services/queryHandler.ts`:

1. **Import Discord.js button components:**
   ```typescript
   import {
     ActionRowBuilder,
     ButtonBuilder,
     ButtonStyle
   } from 'discord.js';
   ```

2. **Update `QueryResponse` interface:**
   ```typescript
   export interface QueryResponse {
     empty: boolean;
     message?: string;
     embed?: EmbedBuilder;
     components?: ActionRowBuilder<ButtonBuilder>[];
   }
   ```

3. **Generate buttons for each visible item** in the formatted sections:
   ```typescript
   function buildItemButtons(
     items: Array<{ id: string; label: string; tableName: string }>
   ): ActionRowBuilder<ButtonBuilder>[] {
     const rows: ActionRowBuilder<ButtonBuilder>[] = [];

     for (const item of items.slice(0, 5)) {
       // Discord limit: 5 buttons per row, 5 rows per message
       const shortLabel = item.label.length > 30
         ? item.label.substring(0, 27) + '...'
         : item.label;

       const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
         new ButtonBuilder()
           .setCustomId(`complete:${item.id}:${item.tableName}`)
           .setLabel(`✅ ${shortLabel}`)
           .setStyle(ButtonStyle.Success),
         new ButtonBuilder()
           .setCustomId(`delete:${item.id}:${item.tableName}`)
           .setLabel('🗑️')
           .setStyle(ButtonStyle.Danger),
       );
       rows.push(row);
     }

     return rows;
   }
   ```

> **Discord Limits:**
> - Max 5 buttons per `ActionRow`.
> - Max 5 `ActionRow`s per message (= 25 buttons total).
> - Since we use 2 buttons per item (✅ + 🗑️) in separate rows, we can show buttons for up to **5 items**.
> - If there are more items, only the first 5 get buttons. The rest can be managed via natural text.

---

### Step 2 — Create Button Interaction Handler

Create a new file `src/bot/handlers/buttonHandler.ts`:

```typescript
import { ButtonInteraction } from 'discord.js';
import { supabase } from '../../db/client.js';

export async function handleButtonInteraction(
  interaction: ButtonInteraction
): Promise<void> {
  const [action, itemId, tableName] = interaction.customId.split(':');

  if (!action || !itemId || !tableName) {
    await interaction.reply({
      content: '⚠️ Invalid button action.',
      ephemeral: true,
    });
    return;
  }

  if (action === 'complete') {
    const { error } = await supabase
      .from(tableName)
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) {
      await interaction.reply({
        content: '❌ Failed to mark as done.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: '✅ Marked as done!',
      ephemeral: true,
    });

    // Disable the button on the original message
    // (update the component to show it's been completed)
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', itemId);

    if (error) {
      await interaction.reply({
        content: '❌ Failed to delete.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: '🗑️ Deleted!',
      ephemeral: true,
    });
  }
}
```

---

### Step 3 — Register Interaction Listener

In `src/bot/client.ts`, add an `InteractionCreate` event handler:

```typescript
import { Events } from 'discord.js';
import { handleButtonInteraction } from './handlers/buttonHandler.js';

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }
});
```

---

### Step 4 — Update Message Handler to Send Components

In `src/bot/handlers/messageHandler.ts`, update the query reply block:

```typescript
if (queryResult.embed) {
  await message.react('📋').catch(() => null);
  await message.reply({
    embeds: [queryResult.embed],
    components: queryResult.components ?? [],
  });
}
```

---

## Files Touched

| File | Change |
|---|---|
| `src/services/queryHandler.ts` | Generate `ActionRowBuilder` buttons for list items |
| `src/bot/handlers/buttonHandler.ts` | **New file** — handles button click interactions |
| `src/bot/client.ts` | Register `InteractionCreate` event listener |
| `src/bot/handlers/messageHandler.ts` | Pass `components` array to message reply |

---

## Acceptance Check

- [ ] `"show me all my todos"` → returns the embed **with ✅ / 🗑️ buttons** below each item.
- [ ] Clicking ✅ on "Buy Flowers" → marks it completed, sends ephemeral "✅ Marked as done!".
- [ ] Clicking 🗑️ → deletes the item, sends ephemeral "🗑️ Deleted!".
- [ ] Buttons are functional on both Discord desktop and mobile.
- [ ] Items beyond the 5-button limit are still visible in the embed text (just without buttons).
