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

CREATE TABLE IF NOT EXISTS student_feedback_profiles (
  student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  speaking_rating INTEGER NOT NULL DEFAULT 0,
  listening_rating INTEGER NOT NULL DEFAULT 0,
  writing_rating INTEGER NOT NULL DEFAULT 0,
  reading_rating INTEGER NOT NULL DEFAULT 0,
  teacher_comment TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (speaking_rating BETWEEN 0 AND 5),
  CHECK (listening_rating BETWEEN 0 AND 5),
  CHECK (writing_rating BETWEEN 0 AND 5),
  CHECK (reading_rating BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  class_time TIME NOT NULL,
  meet_link TEXT,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (status IN ('scheduled', 'pending_change', 'confirmed', 'canceled', 'completed'))
);

ALTER TABLE class_schedules
  DROP CONSTRAINT IF EXISTS class_schedules_status_check;

ALTER TABLE class_schedules
  ADD CONSTRAINT class_schedules_status_check
  CHECK (status IN ('scheduled', 'pending_change', 'confirmed', 'canceled', 'completed'));

CREATE TABLE IF NOT EXISTS teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  available_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, available_date, available_time)
);

CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  reason TEXT,
  previous_schedule_status VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  CHECK (status IN ('pending', 'approved', 'rejected', 'canceled'))
);

ALTER TABLE schedule_change_requests
  ADD COLUMN IF NOT EXISTS previous_schedule_status VARCHAR(30);

CREATE INDEX IF NOT EXISTS class_schedules_student_date_idx
  ON class_schedules (student_id, class_date);

CREATE INDEX IF NOT EXISTS class_schedules_teacher_date_idx
  ON class_schedules (teacher_id, class_date);

CREATE UNIQUE INDEX IF NOT EXISTS class_schedules_teacher_slot_active_idx
  ON class_schedules (teacher_id, class_date, class_time)
  WHERE status <> 'canceled';

CREATE UNIQUE INDEX IF NOT EXISTS class_schedules_student_slot_active_idx
  ON class_schedules (student_id, class_date, class_time)
  WHERE status <> 'canceled';

CREATE INDEX IF NOT EXISTS teacher_availability_teacher_date_idx
  ON teacher_availability (teacher_id, available_date, available_time);

CREATE INDEX IF NOT EXISTS schedule_change_requests_student_idx
  ON schedule_change_requests (student_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_change_requests_one_pending_per_schedule_idx
  ON schedule_change_requests (schedule_id)
  WHERE status = 'pending';
