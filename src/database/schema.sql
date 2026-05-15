CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  deadline DATE NOT NULL,
  points INTEGER NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  teacher_feedback TEXT,
  teacher_summary TEXT,
  teacher_grade INTEGER,
  teacher_observations TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (activity_id, student_id)
);

ALTER TABLE activity_students
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
  ADD COLUMN IF NOT EXISTS teacher_summary TEXT,
  ADD COLUMN IF NOT EXISTS teacher_grade INTEGER,
  ADD COLUMN IF NOT EXISTS teacher_observations TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_students_status_check'
  ) THEN
    ALTER TABLE activity_students
      ADD CONSTRAINT activity_students_status_check
      CHECK (status IN ('pending', 'in_progress', 'completed', 'reviewed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS activity_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(180) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
