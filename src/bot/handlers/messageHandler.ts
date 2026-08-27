import { Message, EmbedBuilder, TextChannel, Client } from 'discord.js';
import { config } from '../../config/env.js';
import { classifyMessage } from '../../services/classifier.js';
import { saveEvent, saveExam, saveInternshipLog } from '../../services/database.js';
import { generateDigestEmbed } from '../../services/digest.js';

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
