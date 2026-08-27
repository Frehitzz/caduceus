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
    .eq('is_completed', false)
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
    .eq('is_completed', false)
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

  let query = supabase.from('exams').select('*').eq('is_completed', false);

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

  let query = supabase.from('events').select('*').eq('is_completed', false);

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

function calculateMatchScore(target: string, text: string): number {
  const t = target.toLowerCase().trim();
  const s = text.toLowerCase().trim();

  if (!t || !s) return 0;
  if (s === t) return 100;
  if (s.includes(t)) return 85;
  if (t.includes(s)) return 70;

  // Keyword token matching
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'my', 'with', 'exam', 'quiz', 'test', 'plan', 'task']);
  const tWords = t.split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));
  if (tWords.length === 0) {
    // Fallback without stopword filter
    const rawWords = t.split(/\s+/).filter((w) => w.length > 1);
    const matched = rawWords.filter((w) => s.includes(w)).length;
    return rawWords.length > 0 ? (matched / rawWords.length) * 50 : 0;
  }

  const matched = tWords.filter((w) => s.includes(w)).length;
  const ratio = matched / tWords.length;
  return ratio >= 0.5 ? Math.round(ratio * 60) : 0;
}

export async function completeExam(
  userId: string,
  targetDescription: string
): Promise<ExamRecord | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false);

  if (error || !data || data.length === 0) {
    return null;
  }

  const candidates = (data as ExamRecord[])
    .map((item) => ({
      item,
      score: Math.max(
        calculateMatchScore(targetDescription, item.subject),
        item.notes ? calculateMatchScore(targetDescription, item.notes) : 0
      ),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = DateTime.fromISO(a.item.exam_date, { zone: config.TIMEZONE }).toMillis();
      const timeB = DateTime.fromISO(b.item.exam_date, { zone: config.TIMEZONE }).toMillis();
      return timeA - timeB;
    });

  const firstCandidate = candidates[0];
  if (!firstCandidate) return null;

  const matched = firstCandidate.item;
  const { data: updated, error: updateError } = await supabase
    .from('exams')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matched.id!)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to complete exam: ${updateError.message}`);
  }
  return updated as ExamRecord;
}

export async function completeEvent(
  userId: string,
  targetDescription: string
): Promise<EventRecord | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false);

  if (error || !data || data.length === 0) {
    return null;
  }

  const candidates = (data as EventRecord[])
    .map((item) => ({
      item,
      score: calculateMatchScore(targetDescription, item.raw_text),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.item.event_date
        ? DateTime.fromISO(a.item.event_date, { zone: config.TIMEZONE }).toMillis()
        : Number.MAX_SAFE_INTEGER;
      const timeB = b.item.event_date
        ? DateTime.fromISO(b.item.event_date, { zone: config.TIMEZONE }).toMillis()
        : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

  const firstCandidate = candidates[0];
  if (!firstCandidate) return null;

  const matched = firstCandidate.item;
  const { data: updated, error: updateError } = await supabase
    .from('events')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matched.id!)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to complete event: ${updateError.message}`);
  }
  return updated as EventRecord;
}

export async function deleteExam(
  userId: string,
  targetDescription: string
): Promise<ExamRecord | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false);

  if (error || !data || data.length === 0) {
    return null;
  }

  const candidates = (data as ExamRecord[])
    .map((item) => ({
      item,
      score: Math.max(
        calculateMatchScore(targetDescription, item.subject),
        item.notes ? calculateMatchScore(targetDescription, item.notes) : 0
      ),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = DateTime.fromISO(a.item.exam_date, { zone: config.TIMEZONE }).toMillis();
      const timeB = DateTime.fromISO(b.item.exam_date, { zone: config.TIMEZONE }).toMillis();
      return timeA - timeB;
    });

  const firstCandidate = candidates[0];
  if (!firstCandidate) return null;

  const matched = firstCandidate.item;
  const { error: deleteError } = await supabase
    .from('exams')
    .delete()
    .eq('id', matched.id!);

  if (deleteError) {
    throw new Error(`Failed to delete exam: ${deleteError.message}`);
  }
  return matched;
}

export async function deleteEvent(
  userId: string,
  targetDescription: string
): Promise<EventRecord | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false);

  if (error || !data || data.length === 0) {
    return null;
  }

  const candidates = (data as EventRecord[])
    .map((item) => ({
      item,
      score: calculateMatchScore(targetDescription, item.raw_text),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.item.event_date
        ? DateTime.fromISO(a.item.event_date, { zone: config.TIMEZONE }).toMillis()
        : Number.MAX_SAFE_INTEGER;
      const timeB = b.item.event_date
        ? DateTime.fromISO(b.item.event_date, { zone: config.TIMEZONE }).toMillis()
        : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

  const firstCandidate = candidates[0];
  if (!firstCandidate) return null;

  const matched = firstCandidate.item;
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('id', matched.id!);

  if (deleteError) {
    throw new Error(`Failed to delete event: ${deleteError.message}`);
  }
  return matched;
}
