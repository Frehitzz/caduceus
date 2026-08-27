-- Caduceus Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Generic plans and events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'plan',
    raw_text TEXT NOT NULL,
    event_date TIMESTAMPTZ,
    channel_posted TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Exams to track and remind about
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_date TIMESTAMPTZ NOT NULL,
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Internship work log entries (Banh Mi Kitchen / LMS project)
CREATE TABLE IF NOT EXISTS internship_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    entry_text TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Sent reminders tracking (prevents duplicate pings)
CREATE TABLE IF NOT EXISTS reminders_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying by user and dates
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_exams_user_date ON exams(user_id, exam_date);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(user_id, is_completed, event_date);
CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(user_id, is_completed, exam_date);
CREATE INDEX IF NOT EXISTS idx_internship_logs_user_logged ON internship_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_exam_sent ON reminders_sent(exam_id, sent_at);

-- Enable Row Level Security (RLS)
-- Server-side bot using SUPABASE_SERVICE_ROLE_KEY bypasses RLS automatically.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders_sent ENABLE ROW LEVEL SECURITY;

