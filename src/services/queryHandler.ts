import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { config } from '../config/env.js';
import {
  queryEvents,
  queryExams,
  queryInternshipLogs,
  type QueryFilterType,
} from './database.js';
import type { EventRecord, ExamRecord, InternshipLogRecord } from '../db/types.js';

export interface QueryResponse {
  empty: boolean;
  message?: string;
  embed?: EmbedBuilder;
}

function formatFilterName(filter: QueryFilterType): string {
  switch (filter) {
    case 'upcoming':
      return 'Upcoming';
    case 'this_week':
      return 'This Week';
    case 'overdue':
      return 'Overdue';
    case 'all':
      return 'All Recorded';
  }
}

function formatExamItem(exam: ExamRecord, now: DateTime): string {
  const examDate = DateTime.fromISO(exam.exam_date, { zone: config.TIMEZONE });
  const diffDays = Math.ceil(examDate.diff(now.startOf('day'), 'days').days);

  let urgency = '';
  if (diffDays < 0) {
    urgency = `⚠️ **OVERDUE** (${examDate.toFormat('MMM d')})`;
  } else if (diffDays === 0) {
    urgency = '🚨 **TODAY**';
  } else if (diffDays === 1) {
    urgency = '⚠️ **TOMORROW**';
  } else {
    urgency = `⏳ **In ${diffDays} days** (${examDate.toFormat('MMM d')})`;
  }

  const notesText = exam.notes ? `\n   ↳ *Notes: ${exam.notes}*` : '';
  return `• ${urgency} — **${exam.subject}**${notesText}`;
}

function formatEventItem(event: EventRecord, now: DateTime): string {
  let dateLabel = 'Upcoming';
  if (event.event_date) {
    const evDate = DateTime.fromISO(event.event_date, { zone: config.TIMEZONE });
    const diffDays = Math.ceil(evDate.diff(now.startOf('day'), 'days').days);
    if (diffDays < 0) {
      dateLabel = `⚠️ Overdue (${evDate.toFormat('MMM d')})`;
    } else if (diffDays === 0) {
      dateLabel = '📅 Today';
    } else if (diffDays === 1) {
      dateLabel = '📅 Tomorrow';
    } else {
      dateLabel = `📅 ${evDate.toFormat('MMM d, EEEE')}`;
    }
  }
  return `• **${dateLabel}**: ${event.raw_text}`;
}

function formatLogItem(log: InternshipLogRecord): string {
  const logDate = log.logged_at
    ? DateTime.fromISO(log.logged_at, { zone: config.TIMEZONE }).toFormat('MMM d, yyyy')
    : 'Recent';
  return `• **[${logDate}]** ${log.entry_text}`;
}

export async function handleQueryIntent(
  userId: string | undefined,
  scope: 'all' | 'plans' | 'exams' | 'internship_log',
  filter: QueryFilterType,
  username?: string
): Promise<QueryResponse> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const filterLabel = formatFilterName(filter);

  // 1. All (plans + exams, excludes logs unless explicitly requested)
  if (scope === 'all') {
    const [exams, events] = await Promise.all([
      queryExams({ userId, filter }),
      queryEvents({ userId, filter }),
    ]);

    if (exams.length === 0 && events.length === 0) {
      return {
        empty: true,
        message:
          filter === 'overdue'
            ? '🎉 No overdue tasks or exams found!'
            : "🎉 Nothing upcoming — you're all caught up!",
      };
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Your Scheduled Todos & Exams')
      .setDescription(`Filter: **${filterLabel}** • Timezone: **${config.TIMEZONE}**`)
      .setColor(0x5865f2)
      .setTimestamp(new Date());

    if (username) {
      embed.setFooter({ text: `Requested by ${username}` });
    }

    if (exams.length > 0) {
      const examLines = exams.slice(0, 10).map((e) => formatExamItem(e, now));
      if (exams.length > 10) {
        examLines.push(`*...and ${exams.length - 10} more exams*`);
      }
      embed.addFields({
        name: `📚 Exams (${exams.length})`,
        value: examLines.join('\n'),
        inline: false,
      });
    }

    if (events.length > 0) {
      const eventLines = events.slice(0, 10).map((e) => formatEventItem(e, now));
      if (events.length > 10) {
        eventLines.push(`*...and ${events.length - 10} more plans*`);
      }
      embed.addFields({
        name: `🗓️ Plans & Events (${events.length})`,
        value: eventLines.join('\n'),
        inline: false,
      });
    }

    return { empty: false, embed };
  }

  // 2. Exams only
  if (scope === 'exams') {
    const exams = await queryExams({ userId, filter });
    if (exams.length === 0) {
      return {
        empty: true,
        message:
          filter === 'overdue'
            ? '🎉 No overdue exams found!'
            : '📚 No upcoming exams found — you are all clear!',
      };
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Your Scheduled Exams')
      .setDescription(`Filter: **${filterLabel}** • Total: **${exams.length}**`)
      .setColor(0xfee75c)
      .setTimestamp(new Date());

    if (username) {
      embed.setFooter({ text: `Requested by ${username}` });
    }

    const examLines = exams.slice(0, 15).map((e) => formatExamItem(e, now));
    if (exams.length > 15) {
      examLines.push(`*...and ${exams.length - 15} more exams*`);
    }

    embed.addFields({
      name: 'Exams List',
      value: examLines.join('\n'),
      inline: false,
    });

    return { empty: false, embed };
  }

  // 3. Plans only
  if (scope === 'plans') {
    const events = await queryEvents({ userId, filter });
    if (events.length === 0) {
      return {
        empty: true,
        message:
          filter === 'overdue'
            ? '🎉 No overdue plans found!'
            : '🗓️ No upcoming plans or events found on file.',
      };
    }

    const embed = new EmbedBuilder()
      .setTitle('🗓️ Your Plans & Events')
      .setDescription(`Filter: **${filterLabel}** • Total: **${events.length}**`)
      .setColor(0x57f287)
      .setTimestamp(new Date());

    if (username) {
      embed.setFooter({ text: `Requested by ${username}` });
    }

    const eventLines = events.slice(0, 15).map((e) => formatEventItem(e, now));
    if (events.length > 15) {
      eventLines.push(`*...and ${events.length - 15} more plans*`);
    }

    embed.addFields({
      name: 'Plans List',
      value: eventLines.join('\n'),
      inline: false,
    });

    return { empty: false, embed };
  }

  // 4. Internship logs only
  if (scope === 'internship_log') {
    const logs = await queryInternshipLogs({ userId, filter });
    if (logs.length === 0) {
      return {
        empty: true,
        message: '💼 No internship work logs found for this filter.',
      };
    }

    const embed = new EmbedBuilder()
      .setTitle('💼 Internship Work Logs (Banh Mi Kitchen LMS)')
      .setDescription(`Filter: **${filterLabel}** • Total: **${logs.length}**`)
      .setColor(0xeb459e)
      .setTimestamp(new Date());

    if (username) {
      embed.setFooter({ text: `Requested by ${username}` });
    }

    const logLines = logs.slice(0, 15).map((l) => formatLogItem(l));
    if (logs.length > 15) {
      logLines.push(`*...and ${logs.length - 15} more logs*`);
    }

    embed.addFields({
      name: 'Work Log Entries',
      value: logLines.join('\n'),
      inline: false,
    });

    return { empty: false, embed };
  }

  return { empty: true, message: "Nothing found for this query." };
}
