-- Add completion tracking to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add completion tracking to exams
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for filtering active (non-completed) items efficiently
CREATE INDEX IF NOT EXISTS idx_events_active ON events(user_id, is_completed, event_date);
CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(user_id, is_completed, exam_date);
