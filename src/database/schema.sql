CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_email_normalized_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_normalized_check
      CHECK (email = lower(trim(email)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  deadline DATE NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  teacher_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_points_check;

ALTER TABLE activities
  ADD CONSTRAINT activities_points_check
  CHECK (points >= 0);

CREATE TABLE IF NOT EXISTS activity_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  teacher_feedback TEXT,
  teacher_grade INTEGER CHECK (teacher_grade IS NULL OR teacher_grade BETWEEN 0 AND 100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (activity_id, student_id)
);

ALTER TABLE activity_students
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
  ADD COLUMN IF NOT EXISTS teacher_grade INTEGER,
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

ALTER TABLE activity_students
  DROP CONSTRAINT IF EXISTS activity_students_teacher_grade_check;

ALTER TABLE activity_students
  ADD CONSTRAINT activity_students_teacher_grade_check
  CHECK (teacher_grade IS NULL OR teacher_grade BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_bucket VARCHAR(120) NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  material_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  attached_at TIMESTAMP WITH TIME ZONE,
  CHECK (material_type IN ('pdf', 'audio', 'docs', 'document', 'video')),
  CHECK (status IN ('pending', 'attached'))
);

CREATE TABLE IF NOT EXISTS activity_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('link', 'pdf', 'audio', 'docs', 'video')),
  title VARCHAR(180) NOT NULL,
  url TEXT CHECK (url IS NULL OR url ~* '^https?://'),
  uploaded_file_id UUID UNIQUE REFERENCES uploaded_files(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_materials
  ADD COLUMN IF NOT EXISTS uploaded_file_id UUID REFERENCES uploaded_files(id);

ALTER TABLE activity_materials
  ALTER COLUMN url DROP NOT NULL;

ALTER TABLE activity_materials
  DROP CONSTRAINT IF EXISTS activity_materials_type_check;

ALTER TABLE activity_materials
  DROP CONSTRAINT IF EXISTS activity_materials_url_http_check;

ALTER TABLE activity_materials
  DROP CONSTRAINT IF EXISTS activity_materials_source_check;

ALTER TABLE activity_materials
  ADD CONSTRAINT activity_materials_type_check
  CHECK (type IN ('link', 'pdf', 'audio', 'docs', 'video'));

ALTER TABLE activity_materials
  ADD CONSTRAINT activity_materials_url_http_check
  CHECK (url IS NULL OR url ~* '^https?://');

ALTER TABLE activity_materials
  ADD CONSTRAINT activity_materials_source_check
  CHECK (
    url IS NOT NULL OR uploaded_file_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS activity_materials_uploaded_file_idx
  ON activity_materials (uploaded_file_id)
  WHERE uploaded_file_id IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL,
  url TEXT CHECK (url IS NULL OR url ~* '^https?://'),
  uploaded_file_id UUID UNIQUE REFERENCES uploaded_files(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (type IN ('pdf', 'video', 'link', 'exercise', 'audio', 'document', 'vocabulary'))
);

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS uploaded_file_id UUID REFERENCES uploaded_files(id);

ALTER TABLE study_materials
  ALTER COLUMN url DROP NOT NULL;

ALTER TABLE study_materials
  DROP CONSTRAINT IF EXISTS study_materials_url_http_check;

ALTER TABLE study_materials
  DROP CONSTRAINT IF EXISTS study_materials_source_check;

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_url_http_check
  CHECK (url IS NULL OR url ~* '^https?://');

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_source_check
  CHECK (
    url IS NOT NULL OR uploaded_file_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS study_materials_uploaded_file_idx
  ON study_materials (uploaded_file_id)
  WHERE uploaded_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS uploaded_files_teacher_status_idx
  ON uploaded_files (teacher_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS study_materials_student_idx
  ON study_materials (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_materials_teacher_idx
  ON study_materials (teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  class_time TIME NOT NULL,
  meet_link TEXT CHECK (meet_link IS NULL OR meet_link ~* '^https?://'),
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (status IN ('scheduled', 'pending_change', 'confirmed', 'canceled', 'completed'))
);

ALTER TABLE class_schedules
  DROP CONSTRAINT IF EXISTS class_schedules_meet_link_http_check;

ALTER TABLE class_schedules
  ADD CONSTRAINT class_schedules_meet_link_http_check
  CHECK (meet_link IS NULL OR meet_link ~* '^https?://');

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
