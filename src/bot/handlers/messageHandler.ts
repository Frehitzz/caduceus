import { Message, EmbedBuilder, TextChannel, Client } from 'discord.js';
import { config } from '../../config/env.js';
import { classifyMessage } from '../../services/classifier.js';
import {
  saveEvent,
  saveExam,
  saveInternshipLog,
  completeExam,
  completeEvent,
  deleteExam,
  deleteEvent,
} from '../../services/database.js';
import { generateDigestEmbed } from '../../services/digest.js';
import { handleQueryIntent } from '../../services/queryHandler.js';

export async function handleMessage(message: Message, client: Client): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Single-user filtering if configured
  if (config.ALLOWED_USER_ID && message.author.id !== config.ALLOWED_USER_ID) {
    return;
  }

  const trimmedContent = message.content.trim();
  if (!trimmedContent) return;

  // Manual digest command trigger: "!digest" or "caduceus digest"
  if (trimmedContent.toLowerCase() === '!digest' || trimmedContent.toLowerCase() === 'caduceus digest') {
    try {
      const digestEmbed = await generateDigestEmbed();
      await message.reply({ embeds: [digestEmbed] });
    } catch (error) {
      console.error('❌ Error generating manual digest:', error);
      await message.reply('❌ Failed to generate digest. Check bot logs.');
    }
    return;
  }

  try {
    // React to show processing
    await message.react('🔍').catch(() => null);

    const classification = await classifyMessage(trimmedContent);

    if (!classification.isActionable || classification.category === 'other') {
      // Remove search emoji if not actionable
      await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);
      return;
    }

    const userId = message.author.id;

    // Handle READ / Query Intent
    if (classification.category === 'query') {
      const queryResult = await handleQueryIntent(
        userId,
        classification.query_scope,
        classification.query_filter,
        message.author.username
      );

      await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);

      if (queryResult.empty) {
        await message.react('✨').catch(() => null);
        await message.reply(queryResult.message ?? "Nothing upcoming — you're all caught up!");
      } else if (queryResult.embed) {
        await message.react('📋').catch(() => null);
        await message.reply({ embeds: [queryResult.embed] });
      }

      console.log(`✅ [QUERY] Handled query (scope: ${classification.query_scope}, filter: ${classification.query_filter})`);
      return;
    }

    // Handle COMPLETE Intent
    if (classification.category === 'complete') {
      const target =
        classification.target_description ||
        classification.subject ||
        classification.cleanedText ||
        trimmedContent;

      await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);

      const completedExam = await completeExam(userId, target);
      if (completedExam) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Exam Completed')
          .setColor(0x57f287)
          .setDescription(`Marked as completed: **${completedExam.subject}**`)
          .setFooter({ text: `Completed by ${message.author.username}` })
          .setTimestamp(new Date());

        if (completedExam.exam_date) {
          embed.addFields({ name: 'Scheduled Date', value: completedExam.exam_date, inline: true });
        }

        await message.react('✅').catch(() => null);
        await message.reply({ embeds: [embed] });
        console.log(`✅ [COMPLETE] Completed exam: "${completedExam.subject}"`);
        return;
      }

      const completedEvent = await completeEvent(userId, target);
      if (completedEvent) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Task / Plan Completed')
          .setColor(0x57f287)
          .setDescription(`Marked as completed: **${completedEvent.raw_text}**`)
          .setFooter({ text: `Completed by ${message.author.username}` })
          .setTimestamp(new Date());

        if (completedEvent.event_date) {
          embed.addFields({ name: 'Scheduled Date', value: completedEvent.event_date, inline: true });
        }

        await message.react('✅').catch(() => null);
        await message.reply({ embeds: [embed] });
        console.log(`✅ [COMPLETE] Completed event: "${completedEvent.raw_text}"`);
        return;
      }

      await message.react('❓').catch(() => null);
      await message.reply(`Couldn't find an active task or exam matching "${target}" to complete.`);
      return;
    }

    // Handle DELETE / CANCEL Intent
    if (classification.category === 'delete') {
      const target =
        classification.target_description ||
        classification.subject ||
        classification.cleanedText ||
        trimmedContent;

      await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);

      const deletedExam = await deleteExam(userId, target);
      if (deletedExam) {
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Exam Removed')
          .setColor(0xed4245)
          .setDescription(`Deleted exam: **${deletedExam.subject}**`)
          .setFooter({ text: `Removed by ${message.author.username}` })
          .setTimestamp(new Date());

        await message.react('🗑️').catch(() => null);
        await message.reply({ embeds: [embed] });
        console.log(`🗑️ [DELETE] Deleted exam: "${deletedExam.subject}"`);
        return;
      }

      const deletedEvent = await deleteEvent(userId, target);
      if (deletedEvent) {
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Plan / Event Cancelled')
          .setColor(0xed4245)
          .setDescription(`Cancelled and removed: **${deletedEvent.raw_text}**`)
          .setFooter({ text: `Removed by ${message.author.username}` })
          .setTimestamp(new Date());

        await message.react('🗑️').catch(() => null);
        await message.reply({ embeds: [embed] });
        console.log(`🗑️ [DELETE] Deleted event: "${deletedEvent.raw_text}"`);
        return;
      }

      await message.react('❓').catch(() => null);
      await message.reply(`Couldn't find an active task or exam matching "${target}" to delete.`);
      return;
    }

    // Handle WRITE Operations (plan, exam, internship_log)
    let targetChannelId: string | undefined;
    let categoryTitle = '';
    let categoryColor = 0x5865f2;
    let emoji = '✅';

    if (classification.category === 'plan') {
      categoryTitle = '🗓️ Plan / Event Captured';
      categoryColor = 0x57f287; // Green
      emoji = '🗓️';
      targetChannelId = config.DISCORD_PLANS_CHANNEL_ID;

      await saveEvent(
        userId,
        'plan',
        classification.cleanedText || trimmedContent,
        classification.date,
        message.channel.id
      );
    } else if (classification.category === 'exam') {
      categoryTitle = '📚 Exam / Test Scheduled';
      categoryColor = 0xfee75c; // Yellow
      emoji = '📚';
      targetChannelId = config.DISCORD_EXAMS_CHANNEL_ID;

      const examDate = classification.date || new Date().toISOString();
      await saveExam(
        userId,
        classification.subject || 'Exam',
        examDate,
        classification.notes
      );
    } else if (classification.category === 'internship_log') {
      categoryTitle = '💼 Internship Work Logged';
      categoryColor = 0xeb459e; // Pink/Magenta
      emoji = '💼';
      targetChannelId = config.DISCORD_INTERNSHIP_CHANNEL_ID;

      await saveInternshipLog(
        userId,
        classification.cleanedText || trimmedContent,
        classification.date ?? undefined
      );
    }

    // Build confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setTitle(categoryTitle)
      .setColor(categoryColor)
      .setDescription(classification.confirmationSummary || classification.cleanedText)
      .addFields(
        { name: 'Summary', value: classification.cleanedText || trimmedContent, inline: false }
      );

    if (classification.date) {
      confirmEmbed.addFields({ name: 'Date / Due', value: classification.date, inline: true });
    }
    if (classification.notes) {
      confirmEmbed.addFields({ name: 'Notes', value: classification.notes, inline: true });
    }

    confirmEmbed.setFooter({ text: `Captured for ${message.author.username}` });

    // Send confirmation to target routing channel if configured and different from current channel
    if (targetChannelId && targetChannelId !== message.channel.id) {
      const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);
      if (targetChannel && targetChannel instanceof TextChannel) {
        await targetChannel.send({ embeds: [confirmEmbed] });
      }
    }

    // Confirm on the originating message
    await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);
    await message.react(emoji).catch(() => null);
    await message.reply({ embeds: [confirmEmbed] });

    console.log(`✅ [${classification.category.toUpperCase()}] Processed: "${classification.confirmationSummary}"`);
  } catch (error) {
    console.error('❌ Error handling message:', error);
    await message.reactions.cache.get('🔍')?.users.remove(client.user?.id).catch(() => null);
    await message.react('⚠️').catch(() => null);
  }
}
