import { supabase } from '../db/client.js';
import type { EventRecord, ExamRecord, InternshipLogRecord } from '../db/types.js';
import { DateTime } from 'luxon';
import { config } from '../config/env.js';

export type QueryFilterType = 'upcoming' | 'all' | 'this_week' | 'overdue';

export async function saveEvent(
  userId: string,
  category: string,
  rawText: string,
  eventDate: string | null,
  channelPosted?: string
): Promise<EventRecord> {
  const { data, error } = await supabase
    .from('events')
    .insert([
      {
        user_id: userId,
        category,
        raw_text: rawText,
        event_date: eventDate,
        channel_posted: channelPosted,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save event: ${error.message}`);
  }
  return data as EventRecord;
}

export async function saveExam(
  userId: string,
  subject: string,
  examDate: string,
  notes?: string | null
): Promise<ExamRecord> {
  const { data, error } = await supabase
    .from('exams')
    .insert([
      {
        user_id: userId,
        subject,
        exam_date: examDate,
        notes: notes ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save exam: ${error.message}`);
  }
  return data as ExamRecord;
}

export async function saveInternshipLog(
  userId: string,
  entryText: string,
  loggedAt?: string
): Promise<InternshipLogRecord> {
  const insertPayload: Partial<InternshipLogRecord> = {
    user_id: userId,
    entry_text: entryText,
  };
  if (loggedAt) {
    insertPayload.logged_at = loggedAt;
  }

  const { data, error } = await supabase
    .from('internship_logs')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save internship log: ${error.message}`);
  }
  return data as InternshipLogRecord;
}

export async function getUpcomingExams(userId?: string, daysAhead = 7): Promise<ExamRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfDay = now.startOf('day').toISO();
  const endOfRange = now.plus({ days: daysAhead }).endOf('day').toISO();

  let query = supabase
    .from('exams')
    .select('*')
    .gte('exam_date', startOfDay)
    .lte('exam_date', endOfRange)
    .order('exam_date', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch upcoming exams: ${error.message}`);
  }
  return (data as ExamRecord[]) ?? [];
}

export async function getUpcomingEvents(userId?: string, daysAhead = 7): Promise<EventRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfDay = now.startOf('day').toISO();
  const endOfRange = now.plus({ days: daysAhead }).endOf('day').toISO();

  let query = supabase
    .from('events')
    .select('*')
    .gte('event_date', startOfDay)
    .lte('event_date', endOfRange)
    .order('event_date', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch upcoming events: ${error.message}`);
  }
  return (data as EventRecord[]) ?? [];
}

export async function getRecentInternshipLogs(userId?: string, daysBack = 2): Promise<InternshipLogRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfRange = now.minus({ days: daysBack }).startOf('day').toISO();

  let query = supabase
    .from('internship_logs')
    .select('*')
    .gte('logged_at', startOfRange)
    .order('logged_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch recent internship logs: ${error.message}`);
  }
  return (data as InternshipLogRecord[]) ?? [];
}

export async function markReminderSent(examId: string): Promise<void> {
  const { error } = await supabase.from('reminders_sent').insert([
    {
      exam_id: examId,
    },
  ]);

  if (error) {
    console.error(`Failed to mark reminder sent for exam ${examId}: ${error.message}`);
  }
}

export async function queryExams(options: {
  userId?: string;
  filter?: QueryFilterType;
}): Promise<ExamRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfDay = now.startOf('day').toISO();
  const endOfWeek = now.plus({ days: 7 }).endOf('day').toISO();
  const filter = options.filter ?? 'upcoming';

  let query = supabase.from('exams').select('*');

  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (filter === 'upcoming') {
    query = query.gte('exam_date', startOfDay).order('exam_date', { ascending: true });
  } else if (filter === 'this_week') {
    query = query
      .gte('exam_date', startOfDay)
      .lte('exam_date', endOfWeek)
      .order('exam_date', { ascending: true });
  } else if (filter === 'overdue') {
    query = query.lt('exam_date', startOfDay).order('exam_date', { ascending: false });
  } else {
    query = query.order('exam_date', { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to query exams: ${error.message}`);
  }
  return (data as ExamRecord[]) ?? [];
}

export async function queryEvents(options: {
  userId?: string;
  filter?: QueryFilterType;
}): Promise<EventRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfDay = now.startOf('day').toISO();
  const endOfWeek = now.plus({ days: 7 }).endOf('day').toISO();
  const filter = options.filter ?? 'upcoming';

  let query = supabase.from('events').select('*');

  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (filter === 'upcoming') {
    query = query.gte('event_date', startOfDay).order('event_date', { ascending: true });
  } else if (filter === 'this_week') {
    query = query
      .gte('event_date', startOfDay)
      .lte('event_date', endOfWeek)
      .order('event_date', { ascending: true });
  } else if (filter === 'overdue') {
    query = query.lt('event_date', startOfDay).order('event_date', { ascending: false });
  } else {
    query = query.order('event_date', { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to query events: ${error.message}`);
  }
  return (data as EventRecord[]) ?? [];
}

export async function queryInternshipLogs(options: {
  userId?: string;
  filter?: QueryFilterType;
}): Promise<InternshipLogRecord[]> {
  const now = DateTime.now().setZone(config.TIMEZONE);
  const startOfDay = now.startOf('day').toISO();
  const startOf7DaysAgo = now.minus({ days: 7 }).startOf('day').toISO();
  const filter = options.filter ?? 'upcoming';

  let query = supabase.from('internship_logs').select('*');

  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (filter === 'this_week' || filter === 'upcoming') {
    query = query.gte('logged_at', startOf7DaysAgo).order('logged_at', { ascending: false });
  } else if (filter === 'overdue') {
    query = query.lt('logged_at', startOfDay).order('logged_at', { ascending: false });
  } else {
    query = query.order('logged_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to query internship logs: ${error.message}`);
  }
  return (data as InternshipLogRecord[]) ?? [];
}
