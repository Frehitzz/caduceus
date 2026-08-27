import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { DateTime } from 'luxon';
import { config } from '../config/env.js';
import { getUpcomingExams, getUpcomingEvents, getRecentInternshipLogs, markReminderSent } from './database.js';

export async function generateDigestEmbed(): Promise<EmbedBuilder> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const formattedToday = now.toFormat('EEEE, MMMM d, yyyy');

  const [exams, events, logs] = await Promise.all([
    getUpcomingExams(config.ALLOWED_USER_ID, 7),
    getUpcomingEvents(config.ALLOWED_USER_ID, 7),
    getRecentInternshipLogs(config.ALLOWED_USER_ID, 2),
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`🌅 Daily Morning Digest — ${formattedToday}`)
    .setColor(0x5865f2)
    .setTimestamp(new Date())
    .setFooter({ text: 'Caduceus Assistant • Asia/Manila' });

  // 1. Exams Section
  if (exams.length > 0) {
    const examLines = exams.map((exam) => {
      const examDate = DateTime.fromISO(exam.exam_date, { zone: config.TIMEZONE });
      const diffDays = Math.ceil(examDate.diff(now.startOf('day'), 'days').days);

      let urgency = '';
      if (diffDays <= 0) {
        urgency = '🚨 **TODAY**';
      } else if (diffDays === 1) {
        urgency = '⚠️ **TOMORROW**';
      } else {
        urgency = `⏳ **In ${diffDays} days** (${examDate.toFormat('MMM d')})`;
      }

      const notesText = exam.notes ? `\n   ↳ *Notes: ${exam.notes}*` : '';
      return `• ${urgency} — **${exam.subject}**${notesText}`;
    });

    embed.addFields({
      name: '📚 Exams & Academic Deadlines (Next 7 Days)',
      value: examLines.join('\n'),
      inline: false,
    });
  } else {
    embed.addFields({
      name: '📚 Exams & Academic Deadlines',
      value: '✅ No exams scheduled for the next 7 days. Enjoy your study peace!',
      inline: false,
    });
  }

  // 2. Plans & Events Section
  if (events.length > 0) {
    const eventLines = events.map((event) => {
      let dateLabel = 'Upcoming';
      if (event.event_date) {
        const evDate = DateTime.fromISO(event.event_date, { zone: config.TIMEZONE });
        const diffDays = Math.ceil(evDate.diff(now.startOf('day'), 'days').days);
        if (diffDays <= 0) {
          dateLabel = '📅 Today';
        } else if (diffDays === 1) {
          dateLabel = '📅 Tomorrow';
        } else {
          dateLabel = `📅 ${evDate.toFormat('MMM d, EEEE')}`;
        }
      }
      return `• **${dateLabel}**: ${event.raw_text}`;
    });

    embed.addFields({
      name: '🗓️ Upcoming Plans & Events',
      value: eventLines.slice(0, 8).join('\n'),
      inline: false,
    });
  } else {
    embed.addFields({
      name: '🗓️ Upcoming Plans & Events',
      value: 'No scheduled events or plans on file for this week.',
      inline: false,
    });
  }

  // 3. Internship Work Logs Section (Banh Mi Kitchen LMS)
  if (logs.length > 0) {
    const logLines = logs.map((log) => {
      const logDate = log.logged_at
        ? DateTime.fromISO(log.logged_at, { zone: config.TIMEZONE }).toFormat('MMM d')
        : 'Recent';
      return `• [${logDate}] ${log.entry_text}`;
    });

    embed.addFields({
      name: '💼 Recent Internship Work (Banh Mi Kitchen LMS)',
      value: logLines.slice(0, 5).join('\n'),
      inline: false,
    });
  }

  return embed;
}

export async function sendDailyDigest(client: Client): Promise<void> {
  try {
    const channel = await client.channels.fetch(config.DISCORD_GENERAL_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) {
      console.error(`❌ Digest channel ${config.DISCORD_GENERAL_CHANNEL_ID} not found or is not a text channel.`);
      return;
    }

    const embed = await generateDigestEmbed();
    await channel.send({
      content: `Good morning! Here is your daily digest for today:`,
      embeds: [embed],
    });

    // Mark reminder for today's exams
    const exams = await getUpcomingExams(config.ALLOWED_USER_ID, 1);
    for (const exam of exams) {
      if (exam.id) {
        await markReminderSent(exam.id);
      }
    }

    console.log('✅ Daily digest sent successfully.');
  } catch (error) {
    console.error('❌ Failed to send daily digest:', error);
  }
}
