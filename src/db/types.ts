export type CategoryType = 'plan' | 'exam' | 'internship_log' | 'query' | 'complete' | 'delete' | 'other';

export interface EventRecord {
  id?: string;
  user_id: string;
  category: string;
  raw_text: string;
  event_date: string | null;
  channel_posted?: string | null;
  is_completed?: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export interface ExamRecord {
  id?: string;
  user_id: string;
  subject: string;
  exam_date: string;
  notes?: string | null;
  is_completed?: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export interface InternshipLogRecord {
  id?: string;
  user_id: string;
  entry_text: string;
  logged_at?: string;
}

export interface ReminderSentRecord {
  id?: string;
  exam_id: string;
  sent_at?: string;
}
