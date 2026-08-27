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

const MAX_ITEMS_PER_SECTION = 8;
const COLOR_URGENT = 0xe67e22; // Orange warning color if items are due today, tomorrow, or overdue
const COLOR_DEFAULT = 0x5865f2; // Calm Discord Blurple

interface FormattedDateResult {
  formattedHeader: string;
  isUrgent: boolean;
  timestampMs: number;
}

function formatDateWithHint(isoDateString: string | null, now: DateTime): FormattedDateResult {
  if (!isoDateString) {
    return {
      formattedHeader: '**Upcoming**',
      isUrgent: false,
      timestampMs: Number.MAX_SAFE_INTEGER,
    };
  }

  const date = DateTime.fromISO(isoDateString, { zone: config.TIMEZONE }).setZone(config.TIMEZONE);
  const targetDay = date.startOf('day');
  const todayDay = now.startOf('day');
  const diffDays = Math.round(targetDay.diff(todayDay, 'days').days);

  const baseDate = date.toFormat('MMM d (EEE)');
  let hint = '';
  let isUrgent = false;

  if (diffDays < 0) {
    hint = 'Overdue';
    isUrgent = true;
  } else if (diffDays === 0) {
    hint = 'Today';
    isUrgent = true;
  } else if (diffDays === 1) {
    hint = 'Tomorrow';
    isUrgent = true;
  } else if (diffDays > 1 && diffDays <= 7) {
    hint = `in ${diffDays} days`;
  }

  const formattedHeader = hint ? `**${baseDate} · ${hint}**` : `**${baseDate}**`;

  return {
    formattedHeader,
    isUrgent,
    timestampMs: date.toMillis(),
  };
}

function formatExamLines(
  exams: ExamRecord[],
  now: DateTime
): { lines: string[]; hasUrgent: boolean } {
  let hasUrgent = false;

  // Sort ascending by exam_date
  const sorted = [...exams].sort((a, b) => {
    const timeA = DateTime.fromISO(a.exam_date, { zone: config.TIMEZONE }).toMillis();
    const timeB = DateTime.fromISO(b.exam_date, { zone: config.TIMEZONE }).toMillis();
    return timeA - timeB;
  });

  const visibleItems = sorted.slice(0, MAX_ITEMS_PER_SECTION);
  const lines = visibleItems.map((exam) => {
    const { formattedHeader, isUrgent } = formatDateWithHint(exam.exam_date, now);
    if (isUrgent) hasUrgent = true;

    let line = `${formattedHeader} — **${exam.subject}**`;
    if (exam.notes) {
      line += ` *(Notes: ${exam.notes})*`;
    }
    return line;
  });

  if (sorted.length > MAX_ITEMS_PER_SECTION) {
    const remaining = sorted.length - MAX_ITEMS_PER_SECTION;
    lines.push(`*+${remaining} more — ask "show me all exams" to narrow it down.*`);
  }

  return { lines, hasUrgent };
}

function formatEventLines(
  events: EventRecord[],
  now: DateTime
): { lines: string[]; hasUrgent: boolean } {
  let hasUrgent = false;

  // Sort: dated items ascending, undated items grouped at the bottom
  const sorted = [...events].sort((a, b) => {
    const timeA = a.event_date
      ? DateTime.fromISO(a.event_date, { zone: config.TIMEZONE }).toMillis()
      : Number.MAX_SAFE_INTEGER;
    const timeB = b.event_date
      ? DateTime.fromISO(b.event_date, { zone: config.TIMEZONE }).toMillis()
      : Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });

  const visibleItems = sorted.slice(0, MAX_ITEMS_PER_SECTION);
  const lines = visibleItems.map((event) => {
    const { formattedHeader, isUrgent } = formatDateWithHint(event.event_date, now);
    if (isUrgent) hasUrgent = true;

    return `${formattedHeader} — ${event.raw_text}`;
  });

  if (sorted.length > MAX_ITEMS_PER_SECTION) {
    const remaining = sorted.length - MAX_ITEMS_PER_SECTION;
    lines.push(`*+${remaining} more — ask "show me all plans" to narrow it down.*`);
  }

  return { lines, hasUrgent };
}

function formatLogLines(
  logs: InternshipLogRecord[]
): { lines: string[] } {
  // Sort descending by logged_at
  const sorted = [...logs].sort((a, b) => {
    const timeA = a.logged_at ? DateTime.fromISO(a.logged_at, { zone: config.TIMEZONE }).toMillis() : 0;
    const timeB = b.logged_at ? DateTime.fromISO(b.logged_at, { zone: config.TIMEZONE }).toMillis() : 0;
    return timeB - timeA;
  });

  const visibleItems = sorted.slice(0, MAX_ITEMS_PER_SECTION);
  const lines = visibleItems.map((log) => {
    const logDate = log.logged_at
      ? DateTime.fromISO(log.logged_at, { zone: config.TIMEZONE }).toFormat('MMM d (EEE)')
      : 'Recent';
    return `**${logDate}** — ${log.entry_text}`;
  });

  if (sorted.length > MAX_ITEMS_PER_SECTION) {
    const remaining = sorted.length - MAX_ITEMS_PER_SECTION;
    lines.push(`*+${remaining} more — ask "show me all logs" to narrow it down.*`);
  }

  return { lines };
}

export async function handleQueryIntent(
  userId: string | undefined,
  scope: 'all' | 'plans' | 'exams' | 'internship_log',
  filter: QueryFilterType,
  username?: string
): Promise<QueryResponse> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const userTag = username ? `Requested by ${username}` : 'Caduceus Assistant';
  const footerText = `${userTag} • ${config.TIMEZONE}`;

  // 1. All Todos & Scheduled Items (Exams + Plans)
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

    const { lines: examLines, hasUrgent: examUrgent } = formatExamLines(exams, now);
    const { lines: eventLines, hasUrgent: eventUrgent } = formatEventLines(events, now);

    const isAnyUrgent = examUrgent || eventUrgent;
    const sideColor = isAnyUrgent ? COLOR_URGENT : COLOR_DEFAULT;

    const embed = new EmbedBuilder()
      .setTitle('📋 Your Todos')
      .setColor(sideColor)
      .setFooter({ text: footerText })
      .setTimestamp(new Date());

    if (examLines.length > 0) {
      embed.addFields({
        name: '📝 Exams',
        value: examLines.join('\n'),
        inline: false,
      });
    }

    if (eventLines.length > 0) {
      embed.addFields({
        name: '📅 Plans & Events',
        value: eventLines.join('\n'),
        inline: false,
      });
    }

    return { empty: false, embed };
  }

  // 2. Exams Only
  if (scope === 'exams') {
    const exams = await queryExams({ userId, filter });
    if (exams.length === 0) {
      return {
        empty: true,
        message:
          filter === 'overdue'
            ? '🎉 No overdue exams found!'
            : '📝 No upcoming exams found — you are all clear!',
      };
    }

    const { lines: examLines, hasUrgent } = formatExamLines(exams, now);
    const sideColor = hasUrgent ? COLOR_URGENT : COLOR_DEFAULT;

    const embed = new EmbedBuilder()
      .setTitle('📝 Your Exams')
      .setColor(sideColor)
      .setFooter({ text: footerText })
      .setTimestamp(new Date())
      .addFields({
        name: 'Scheduled Exams',
        value: examLines.join('\n'),
        inline: false,
      });

    return { empty: false, embed };
  }

  // 3. Plans Only
  if (scope === 'plans') {
    const events = await queryEvents({ userId, filter });
    if (events.length === 0) {
      return {
        empty: true,
        message:
          filter === 'overdue'
            ? '🎉 No overdue plans found!'
            : '📅 No upcoming plans or events found on file.',
      };
    }

    const { lines: eventLines, hasUrgent } = formatEventLines(events, now);
    const sideColor = hasUrgent ? COLOR_URGENT : COLOR_DEFAULT;

    const embed = new EmbedBuilder()
      .setTitle('📅 Your Plans & Events')
      .setColor(sideColor)
      .setFooter({ text: footerText })
      .setTimestamp(new Date())
      .addFields({
        name: 'Scheduled Plans',
        value: eventLines.join('\n'),
        inline: false,
      });

    return { empty: false, embed };
  }

  // 4. Internship Logs Only
  if (scope === 'internship_log') {
    const logs = await queryInternshipLogs({ userId, filter });
    if (logs.length === 0) {
      return {
        empty: true,
        message: '💼 No internship work logs found for this filter.',
      };
    }

    const { lines: logLines } = formatLogLines(logs);

    const embed = new EmbedBuilder()
      .setTitle('💼 Internship Work Logs (Banh Mi Kitchen LMS)')
      .setColor(0xeb459e)
      .setFooter({ text: footerText })
      .setTimestamp(new Date())
      .addFields({
        name: 'Work Log Entries',
        value: logLines.join('\n'),
        inline: false,
      });

    return { empty: false, embed };
  }

  return { empty: true, message: "Nothing found for this query." };
}
