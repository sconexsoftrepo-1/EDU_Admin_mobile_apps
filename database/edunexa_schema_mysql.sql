-- =============================================================================================
-- EduNexa College database schema — MySQL 8.0.16+ (InnoDB, utf8mb4)
--
-- MySQL edition of edunexa_schema_postgresql.sql: the same 146 tables, columns, keys, foreign
-- keys, CHECK rules, indexes, validation triggers and finance views. The application backend runs
-- on PostgreSQL (Supabase); this file is for MySQL deployments and tooling.
--
-- The file ends with the college's reference data (institution, campus, departments and the
-- course catalog), kept in step with the PostgreSQL file by backend/tools/export_seed_sql.py.
--
-- Run with the mysql client (the trigger section uses DELIMITER):
--     mysql -u <user> -p <database> < edunexa_schema_mysql.sql
--
-- Differences from the PostgreSQL schema:
--   * TIMESTAMPTZ  -> DATETIME(6), stored in UTC (set the session time_zone to '+00:00').
--   * JSONB and TEXT[] -> JSON (document_types.accepted_mime_types is a JSON array of strings).
--   * TEXT columns that are keys, indexed or have a default -> VARCHAR(255).
--   * updated_at columns use ON UPDATE CURRENT_TIMESTAMP(6) instead of touch_updated_at triggers.
--   * Partial unique indexes (UNIQUE ... WHERE) are enforced through stored generated columns
--     named uqk_<index>_<column> with a UNIQUE key; they hold the value only while the condition
--     holds (NULL otherwise, and MySQL allows repeated NULLs).
--   * Foreign keys keep ON UPDATE CASCADE / ON DELETE RESTRICT, except on columns used by CHECK
--     constraints or generated columns, where MySQL only allows RESTRICT.
--   * Tables use the case-sensitive collation utf8mb4_0900_as_cs, so codes and status values
--     compare exactly as in PostgreSQL.
--   * Validation triggers raise SQLSTATE 45000 with the same messages as the PL/pgSQL versions.
--     Each PostgreSQL "INSERT OR UPDATE" trigger becomes a _insert and an _update trigger.
--   * Row level security (Supabase Data API protection) has no MySQL equivalent and is omitted.
-- =============================================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE institutions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  postal_code VARCHAR(100) NULL,
  country TEXT NULL,
  website TEXT NULL,
  affiliation TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY institutions_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE campuses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  institution_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  postal_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY campuses_code_key (code),
  KEY ix_campuses_institution_code (institution_code),
  CONSTRAINT campuses_institution_code_fkey FOREIGN KEY (institution_code) REFERENCES institutions (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE academic_years (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY academic_years_code_key (code),
  CONSTRAINT academic_years_check CHECK ((end_date > start_date))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE departments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY departments_code_key (code),
  KEY ix_departments_campus_code (campus_code),
  CONSTRAINT departments_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE programs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  department_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  qualification TEXT NOT NULL,
  duration_semesters INT NOT NULL,
  intake_capacity INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  course_level VARCHAR(50) NULL,
  branch TEXT NULL,
  category VARCHAR(255) NULL,
  duration_label TEXT NULL,
  semesters_label TEXT NULL,
  career_opportunities TEXT NULL,
  subjects TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY programs_code_key (code),
  KEY ix_programs_category (category),
  KEY ix_programs_course_level (course_level),
  KEY ix_programs_department_code (department_code),
  CONSTRAINT programs_course_level_check CHECK ((course_level IN ('intermediate', 'degree'))),
  CONSTRAINT programs_duration_semesters_check CHECK ((duration_semesters > 0)),
  CONSTRAINT programs_intake_capacity_check CHECK ((intake_capacity > 0)),
  CONSTRAINT programs_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE batches (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  entry_year INT NOT NULL,
  graduation_year INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY batches_code_key (code),
  KEY ix_batches_program_code (program_code),
  CONSTRAINT batches_entry_year_check CHECK ((entry_year > 0)),
  CONSTRAINT batches_graduation_year_check CHECK ((graduation_year > 0)),
  CONSTRAINT batches_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE semesters (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  semester_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY semesters_code_key (code),
  KEY ix_semesters_academic_year_code (academic_year_code),
  CONSTRAINT semesters_check CHECK ((end_date > start_date)),
  CONSTRAINT semesters_semester_number_check CHECK ((semester_number > 0)),
  CONSTRAINT semesters_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  batch_code VARCHAR(100) NOT NULL,
  semester_code VARCHAR(100) NULL,
  name TEXT NOT NULL,
  capacity INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY sections_code_key (code),
  KEY ix_sections_batch_code (batch_code),
  KEY ix_sections_semester_code (semester_code),
  CONSTRAINT sections_capacity_check CHECK ((capacity > 0)),
  CONSTRAINT sections_batch_code_fkey FOREIGN KEY (batch_code) REFERENCES batches (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sections_semester_code_fkey FOREIGN KEY (semester_code) REFERENCES semesters (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE subjects (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  department_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  credits DECIMAL(12,2) NOT NULL,
  subject_type VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY subjects_code_key (code),
  KEY ix_subjects_department_code (department_code),
  CONSTRAINT subjects_credits_check CHECK ((credits >= (0))),
  CONSTRAINT subjects_subject_type_check CHECK ((subject_type IN ('theory', 'practical', 'project', 'elective'))),
  CONSTRAINT subjects_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE curriculum_subjects (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  subject_code VARCHAR(100) NOT NULL,
  semester_number INT NOT NULL,
  is_required BOOLEAN NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY curriculum_subjects_code_key (code),
  UNIQUE KEY curriculum_subjects_program_code_subject_code_semester_numb_key (program_code, subject_code, semester_number),
  KEY ix_curriculum_subjects_program_code (program_code),
  KEY ix_curriculum_subjects_subject_code (subject_code),
  CONSTRAINT curriculum_subjects_semester_number_check CHECK ((semester_number > 0)),
  CONSTRAINT curriculum_subjects_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT curriculum_subjects_subject_code_fkey FOREIGN KEY (subject_code) REFERENCES subjects (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE rooms (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  capacity INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY rooms_code_key (code),
  KEY ix_rooms_campus_code (campus_code),
  CONSTRAINT rooms_capacity_check CHECK ((capacity > 0)),
  CONSTRAINT rooms_room_type_check CHECK ((room_type IN ('classroom', 'laboratory', 'hall', 'office'))),
  CONSTRAINT rooms_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE employees (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  department_code VARCHAR(100) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  employee_type VARCHAR(50) NOT NULL,
  designation TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  date_of_birth DATE NULL,
  gender VARCHAR(50) NULL,
  join_date DATE NOT NULL,
  employment_type VARCHAR(50) NOT NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  postal_code VARCHAR(100) NULL,
  emergency_contact_name TEXT NULL,
  emergency_contact_phone VARCHAR(40) NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  personal_email VARCHAR(254) NULL,
  middle_name TEXT NULL,
  contract_end_date DATE NULL,
  confirmation_date DATE NULL,
  exit_date DATE NULL,
  reporting_employee_code VARCHAR(100) NULL,
  address_details JSON NULL,
  qualifications JSON NULL,
  appointment_document_reference TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY employees_code_key (code),
  KEY ix_employees_campus_code (campus_code),
  KEY ix_employees_department_code (department_code),
  CONSTRAINT ck_employee_dates CHECK ((((contract_end_date IS NULL) OR (contract_end_date >= join_date)) AND ((exit_date IS NULL) OR (exit_date >= join_date)))),
  CONSTRAINT ck_no_self_reporting CHECK (((reporting_employee_code IS NULL) OR ((reporting_employee_code) <> (code)))),
  CONSTRAINT employees_employee_type_check CHECK ((employee_type IN ('teacher', 'staff'))),
  CONSTRAINT employees_employment_type_check CHECK ((employment_type IN ('permanent', 'contract', 'part_time'))),
  CONSTRAINT employees_gender_check CHECK ((gender IN ('female', 'male', 'other', 'prefer_not_to_say'))),
  CONSTRAINT employees_status_check CHECK ((status IN ('active', 'on_leave', 'left'))),
  CONSTRAINT employees_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT employees_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT employees_reporting_employee_code_fkey FOREIGN KEY (reporting_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE teachers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  qualification TEXT NOT NULL,
  specialization TEXT NULL,
  experience_years DECIMAL(12,2) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY teachers_code_key (code),
  UNIQUE KEY teachers_employee_code_key (employee_code),
  KEY ix_teachers_employee_code (employee_code),
  CONSTRAINT teachers_experience_years_check CHECK ((experience_years >= (0))),
  CONSTRAINT teachers_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE staff_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  responsibility TEXT NOT NULL,
  shift TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY staff_profiles_code_key (code),
  UNIQUE KEY staff_profiles_employee_code_key (employee_code),
  KEY ix_staff_profiles_employee_code (employee_code),
  CONSTRAINT staff_profiles_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE students (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  admission_number VARCHAR(100) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(50) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  admission_date DATE NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code VARCHAR(100) NOT NULL,
  country TEXT NOT NULL,
  blood_group VARCHAR(50) NULL,
  nationality TEXT NULL,
  previous_institution TEXT NULL,
  previous_qualification TEXT NULL,
  previous_score DECIMAL(12,2) NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone VARCHAR(40) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  middle_name TEXT NULL,
  preferred_name TEXT NULL,
  permanent_address JSON NULL,
  current_address_details JSON NULL,
  university_registration_number VARCHAR(100) NULL,
  admission_category TEXT NULL,
  previous_education JSON NULL,
  profile_photo_storage_key TEXT NULL,
  relieved_on DATE NULL,
  relieving_reason TEXT NULL,
  admission_application_code VARCHAR(100) NULL,
  aadhaar_number VARCHAR(12) NULL,
  current_year SMALLINT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY students_aadhaar_number_key (aadhaar_number),
  UNIQUE KEY students_admission_application_code_key (admission_application_code),
  UNIQUE KEY students_admission_number_key (admission_number),
  UNIQUE KEY students_code_key (code),
  KEY ix_students_campus_code (campus_code),
  CONSTRAINT students_blood_group_check CHECK ((blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'))),
  CONSTRAINT students_gender_check CHECK ((gender IN ('female', 'male', 'other', 'prefer_not_to_say'))),
  CONSTRAINT students_previous_score_check CHECK ((previous_score >= (0))),
  CONSTRAINT students_status_check CHECK ((status IN ('active', 'graduated', 'withdrawn', 'suspended', 'relieved'))),
  CONSTRAINT students_aadhaar_number_check CHECK (REGEXP_LIKE(aadhaar_number, '^[0-9]{12}$', 'c')),
  CONSTRAINT students_current_year_check CHECK (((current_year >= 1) AND (current_year <= 10))),
  CONSTRAINT students_admission_application_code_fkey FOREIGN KEY (admission_application_code) REFERENCES admission_applications (code),
  CONSTRAINT students_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE parents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NOT NULL,
  alternate_phone VARCHAR(40) NULL,
  occupation TEXT NULL,
  address TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  postal_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  work_contact JSON NULL,
  preferred_language TEXT NULL,
  address_details JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY parents_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_parents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  parent_code VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  is_primary BOOLEAN NOT NULL,
  can_pickup BOOLEAN NOT NULL,
  receives_notifications BOOLEAN NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_primary_parent_student_code VARCHAR(100) GENERATED ALWAYS AS (IF(is_primary, student_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY student_parents_code_key (code),
  UNIQUE KEY student_parents_student_code_parent_code_key (student_code, parent_code),
  KEY ix_student_parents_parent_code (parent_code),
  KEY ix_student_parents_student_code (student_code),
  UNIQUE KEY uq_primary_parent (uqk_uq_primary_parent_student_code),
  CONSTRAINT student_parents_relationship_check CHECK ((relationship IN ('father', 'mother', 'guardian', 'other'))),
  CONSTRAINT student_parents_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_parents_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_enrollments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  roll_number VARCHAR(100) NOT NULL,
  enrolled_on DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_enrollments_code_key (code),
  UNIQUE KEY student_enrollments_section_code_roll_number_key (section_code, roll_number),
  UNIQUE KEY student_enrollments_student_code_section_code_key (student_code, section_code),
  KEY ix_student_enrollments_section_code (section_code),
  KEY ix_student_enrollments_student_code (student_code),
  CONSTRAINT student_enrollments_status_check CHECK ((status IN ('active', 'completed', 'transferred', 'withdrawn'))),
  CONSTRAINT student_enrollments_section_code_fkey FOREIGN KEY (section_code) REFERENCES sections (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_enrollments_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE subject_offerings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  subject_code VARCHAR(100) NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  teacher_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY subject_offerings_code_key (code),
  UNIQUE KEY subject_offerings_subject_code_section_code_teacher_code_key (subject_code, section_code, teacher_code),
  KEY ix_subject_offerings_section_code (section_code),
  KEY ix_subject_offerings_subject_code (subject_code),
  KEY ix_subject_offerings_teacher_code (teacher_code),
  CONSTRAINT subject_offerings_section_code_fkey FOREIGN KEY (section_code) REFERENCES sections (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT subject_offerings_subject_code_fkey FOREIGN KEY (subject_code) REFERENCES subjects (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT subject_offerings_teacher_code_fkey FOREIGN KEY (teacher_code) REFERENCES teachers (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_subjects (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  enrollment_code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_subjects_code_key (code),
  UNIQUE KEY student_subjects_enrollment_code_offering_code_key (enrollment_code, offering_code),
  KEY ix_student_subjects_enrollment_code (enrollment_code),
  KEY ix_student_subjects_offering_code (offering_code),
  CONSTRAINT student_subjects_enrollment_code_fkey FOREIGN KEY (enrollment_code) REFERENCES student_enrollments (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_subjects_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE timetable_slots (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  room_code VARCHAR(100) NOT NULL,
  weekday SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY timetable_slots_code_key (code),
  UNIQUE KEY timetable_slots_room_code_weekday_start_time_key (room_code, weekday, start_time),
  KEY ix_timetable_slots_offering_code (offering_code),
  KEY ix_timetable_slots_room_code (room_code),
  CONSTRAINT timetable_slots_check CHECK ((end_time > start_time)),
  CONSTRAINT timetable_slots_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7))),
  CONSTRAINT timetable_slots_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT timetable_slots_room_code_fkey FOREIGN KEY (room_code) REFERENCES rooms (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE attendance_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recorded_by_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY attendance_sessions_code_key (code),
  UNIQUE KEY attendance_sessions_offering_code_session_date_start_time_key (offering_code, session_date, start_time),
  KEY ix_attendance_sessions_offering_code (offering_code),
  KEY ix_attendance_sessions_recorded_by_code (recorded_by_code),
  CONSTRAINT attendance_sessions_check CHECK ((end_time > start_time)),
  CONSTRAINT attendance_sessions_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT attendance_sessions_recorded_by_code_fkey FOREIGN KEY (recorded_by_code) REFERENCES teachers (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_attendance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  session_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  remarks TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_attendance_code_key (code),
  UNIQUE KEY student_attendance_session_code_student_code_key (session_code, student_code),
  KEY ix_student_attendance_session_code (session_code),
  KEY ix_student_attendance_student_code (student_code),
  CONSTRAINT student_attendance_status_check CHECK ((status IN ('present', 'absent', 'late', 'excused'))),
  CONSTRAINT student_attendance_session_code_fkey FOREIGN KEY (session_code) REFERENCES attendance_sessions (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_attendance_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE employee_attendance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  attendance_date DATE NOT NULL,
  check_in DATETIME(6) NULL,
  check_out DATETIME(6) NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY employee_attendance_code_key (code),
  UNIQUE KEY employee_attendance_employee_code_attendance_date_key (employee_code, attendance_date),
  KEY ix_employee_attendance_employee_code (employee_code),
  CONSTRAINT employee_attendance_check CHECK (((check_out IS NULL) OR (check_in IS NULL) OR (check_out >= check_in))),
  CONSTRAINT employee_attendance_status_check CHECK ((status IN ('present', 'absent', 'leave', 'holiday', 'half_day'))),
  CONSTRAINT employee_attendance_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE leave_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  annual_days DECIMAL(12,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY leave_types_code_key (code),
  CONSTRAINT leave_types_annual_days_check CHECK ((annual_days >= (0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE leave_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  leave_type_code VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  approved_by_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY leave_requests_code_key (code),
  KEY ix_leave_requests_approved_by_code (approved_by_code),
  KEY ix_leave_requests_employee_code (employee_code),
  KEY ix_leave_requests_leave_type_code (leave_type_code),
  CONSTRAINT leave_requests_check CHECK ((end_date >= start_date)),
  CONSTRAINT leave_requests_status_check CHECK ((status IN ('pending', 'approved', 'rejected', 'cancelled'))),
  CONSTRAINT leave_requests_approved_by_code_fkey FOREIGN KEY (approved_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT leave_requests_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT leave_requests_leave_type_code_fkey FOREIGN KEY (leave_type_code) REFERENCES leave_types (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_leave_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  approved_by_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_leave_requests_code_key (code),
  KEY ix_student_leave_requests_approved_by_code (approved_by_code),
  KEY ix_student_leave_requests_student_code (student_code),
  CONSTRAINT student_leave_requests_check CHECK ((end_date >= start_date)),
  CONSTRAINT student_leave_requests_status_check CHECK ((status IN ('pending', 'approved', 'rejected', 'cancelled'))),
  CONSTRAINT student_leave_requests_approved_by_code_fkey FOREIGN KEY (approved_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_leave_requests_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_applications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  applied_on DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  student_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  enquiry_code VARCHAR(100) NULL,
  cycle_code VARCHAR(100) NULL,
  source_code VARCHAR(100) NULL,
  date_of_birth DATE NULL,
  gender TEXT NULL,
  admission_category VARCHAR(50) NOT NULL DEFAULT 'regular',
  address JSON NOT NULL DEFAULT (JSON_OBJECT()),
  consent_at DATETIME(6) NULL,
  submitted_at DATETIME(6) NULL,
  assigned_employee_code VARCHAR(100) NULL,
  submitted_by_user_code VARCHAR(100) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY admission_applications_code_key (code),
  KEY ix_admission_applications_academic_year_code (academic_year_code),
  KEY ix_admission_applications_program_code (program_code),
  KEY ix_admission_applications_student_code (student_code),
  UNIQUE KEY uq_application_student (student_code),
  CONSTRAINT admission_applications_admission_category_check CHECK ((admission_category IN ('regular', 'lateral_entry', 'transfer', 'readmission'))),
  CONSTRAINT admission_applications_status_check CHECK ((status IN ('draft', 'submitted', 'documents_pending', 'reviewing', 'verified', 'offered', 'accepted', 'enrolled', 'rejected', 'withdrawn'))),
  CONSTRAINT admission_applications_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT admission_applications_assigned_employee_code_fkey FOREIGN KEY (assigned_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_applications_cycle_code_fkey FOREIGN KEY (cycle_code) REFERENCES admission_cycles (code),
  CONSTRAINT admission_applications_enquiry_code_fkey FOREIGN KEY (enquiry_code) REFERENCES admission_enquiries (code),
  CONSTRAINT admission_applications_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT admission_applications_source_code_fkey FOREIGN KEY (source_code) REFERENCES admission_sources (code),
  CONSTRAINT admission_applications_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT admission_applications_submitted_by_user_code_fkey FOREIGN KEY (submitted_by_user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE fee_heads (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  collection_ownership VARCHAR(50) NOT NULL DEFAULT 'internal',
  external_party_code VARCHAR(100) NULL,
  scholarship_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  category VARCHAR(50) NOT NULL DEFAULT 'academic',
  PRIMARY KEY (id),
  UNIQUE KEY fee_heads_code_key (code),
  CONSTRAINT fee_heads_category_check CHECK ((category IN ('academic', 'hostel', 'transport', 'other'))),
  CONSTRAINT ck_external_head_party CHECK (((collection_ownership <> 'external') OR (external_party_code IS NOT NULL))),
  CONSTRAINT fee_heads_collection_ownership_check CHECK ((collection_ownership IN ('internal', 'external'))),
  CONSTRAINT fee_heads_external_party_code_fkey FOREIGN KEY (external_party_code) REFERENCES external_parties (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE fee_structures (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  fee_head_code VARCHAR(100) NOT NULL,
  semester_number INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  installment_number INT NOT NULL DEFAULT 1,
  billing_frequency VARCHAR(50) NOT NULL DEFAULT 'semester',
  approval_reference TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY fee_structures_code_key (code),
  UNIQUE KEY uq_fee_structure_installment (program_code, academic_year_code, fee_head_code, semester_number, installment_number),
  KEY ix_fee_structures_academic_year_code (academic_year_code),
  KEY ix_fee_structures_fee_head_code (fee_head_code),
  KEY ix_fee_structures_program_code (program_code),
  CONSTRAINT fee_structures_amount_check CHECK ((amount >= (0))),
  CONSTRAINT fee_structures_billing_frequency_check CHECK ((billing_frequency IN ('one_time', 'annual', 'semester', 'term', 'monthly', 'per_use'))),
  CONSTRAINT fee_structures_installment_number_check CHECK ((installment_number > 0)),
  CONSTRAINT fee_structures_semester_number_check CHECK ((semester_number > 0)),
  CONSTRAINT fee_structures_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fee_structures_fee_head_code_fkey FOREIGN KEY (fee_head_code) REFERENCES fee_heads (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fee_structures_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_fee_charges (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  fee_structure_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  due_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY student_fee_charges_code_key (code),
  UNIQUE KEY student_fee_charges_student_code_fee_structure_code_key (student_code, fee_structure_code),
  KEY ix_student_fee_charges_fee_structure_code (fee_structure_code),
  KEY ix_student_fee_charges_student_code (student_code),
  CONSTRAINT student_fee_charges_amount_check CHECK ((amount >= (0))),
  CONSTRAINT student_fee_charges_tax_amount_check CHECK ((tax_amount >= (0))),
  CONSTRAINT student_fee_charges_fee_structure_code_fkey FOREIGN KEY (fee_structure_code) REFERENCES fee_structures (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_fee_charges_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(100) NOT NULL,
  paid_on DATE NOT NULL,
  method VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  idempotency_key VARCHAR(200) NULL,
  request JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY payments_code_key (code),
  UNIQUE KEY payments_idempotency_key_key (idempotency_key),
  KEY ix_payments_student_code (student_code),
  CONSTRAINT payments_amount_check CHECK ((amount >= (0))),
  CONSTRAINT payments_method_check CHECK ((method IN ('cash', 'bank_transfer', 'upi', 'card', 'cheque'))),
  CONSTRAINT payments_status_check CHECK ((status IN ('pending', 'settled', 'failed', 'refunded'))),
  CONSTRAINT payments_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payment_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  payment_code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payment_allocations_code_key (code),
  UNIQUE KEY payment_allocations_payment_code_charge_code_key (payment_code, charge_code),
  KEY ix_payment_allocations_charge_code (charge_code),
  KEY ix_payment_allocations_payment_code (payment_code),
  CONSTRAINT payment_allocations_amount_check CHECK ((amount >= (0))),
  CONSTRAINT payment_allocations_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT payment_allocations_payment_code_fkey FOREIGN KEY (payment_code) REFERENCES payments (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE receipts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  payment_code VARCHAR(100) NOT NULL,
  receipt_number VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY receipts_code_key (code),
  UNIQUE KEY receipts_payment_code_key (payment_code),
  UNIQUE KEY receipts_receipt_number_key (receipt_number),
  KEY ix_receipts_payment_code (payment_code),
  CONSTRAINT receipts_payment_code_fkey FOREIGN KEY (payment_code) REFERENCES payments (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refunds (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  payment_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reason TEXT NOT NULL,
  refunded_on DATE NOT NULL,
  reference VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY refunds_code_key (code),
  KEY ix_refunds_payment_code (payment_code),
  CONSTRAINT refunds_amount_check CHECK ((amount >= (0))),
  CONSTRAINT refunds_payment_code_fkey FOREIGN KEY (payment_code) REFERENCES payments (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE scholarships (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  sponsor TEXT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  maximum_amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  award_method VARCHAR(50) NOT NULL DEFAULT 'fixed_amount',
  award_percent DECIMAL(5,2) NULL,
  eligibility_rules JSON NOT NULL DEFAULT (JSON_OBJECT()),
  PRIMARY KEY (id),
  UNIQUE KEY scholarships_code_key (code),
  KEY ix_scholarships_academic_year_code (academic_year_code),
  CONSTRAINT ck_percent_scholarship CHECK ((((award_method = 'percentage') AND (award_percent IS NOT NULL)) OR ((award_method = 'fixed_amount') AND (award_percent IS NULL)))),
  CONSTRAINT scholarships_award_method_check CHECK ((award_method IN ('fixed_amount', 'percentage'))),
  CONSTRAINT scholarships_award_percent_check CHECK (((award_percent >= (0)) AND (award_percent <= (100)))),
  CONSTRAINT scholarships_maximum_amount_check CHECK ((maximum_amount >= (0))),
  CONSTRAINT scholarships_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_scholarships (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  scholarship_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_scholarships_code_key (code),
  UNIQUE KEY student_scholarships_student_code_scholarship_code_key (student_code, scholarship_code),
  KEY ix_student_scholarships_scholarship_code (scholarship_code),
  KEY ix_student_scholarships_student_code (student_code),
  CONSTRAINT student_scholarships_amount_check CHECK ((amount >= (0))),
  CONSTRAINT student_scholarships_status_check CHECK ((status IN ('pending', 'approved', 'rejected', 'disbursed'))),
  CONSTRAINT student_scholarships_scholarship_code_fkey FOREIGN KEY (scholarship_code) REFERENCES scholarships (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_scholarships_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE fee_adjustments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  adjustment_type VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY fee_adjustments_code_key (code),
  KEY ix_fee_adjustments_approved_by_code (approved_by_code),
  KEY ix_fee_adjustments_charge_code (charge_code),
  CONSTRAINT fee_adjustments_adjustment_type_check CHECK ((adjustment_type IN ('discount', 'waiver', 'fine'))),
  CONSTRAINT fee_adjustments_amount_check CHECK ((amount >= (0))),
  CONSTRAINT fee_adjustments_approved_by_code_fkey FOREIGN KEY (approved_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fee_adjustments_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vendors (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  tax_reference VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vendors_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE expenses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  vendor_code VARCHAR(100) NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(100) NOT NULL,
  expense_date DATE NOT NULL,
  approved_by_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  paid_on DATE NULL,
  PRIMARY KEY (id),
  UNIQUE KEY expenses_code_key (code),
  KEY ix_expenses_approved_by_code (approved_by_code),
  KEY ix_expenses_campus_code (campus_code),
  KEY ix_expenses_vendor_code (vendor_code),
  CONSTRAINT ck_expense_paid_date CHECK (((payment_status <> 'paid') OR (paid_on IS NOT NULL))),
  CONSTRAINT expenses_amount_check CHECK ((amount >= (0))),
  CONSTRAINT expenses_payment_status_check CHECK ((payment_status IN ('unpaid', 'paid', 'void'))),
  CONSTRAINT expenses_approved_by_code_fkey FOREIGN KEY (approved_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT expenses_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT expenses_vendor_code_fkey FOREIGN KEY (vendor_code) REFERENCES vendors (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE employee_salary_components (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  component TEXT NOT NULL,
  component_type VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY employee_salary_components_code_key (code),
  KEY ix_employee_salary_components_employee_code (employee_code),
  CONSTRAINT employee_salary_components_amount_check CHECK ((amount >= (0))),
  CONSTRAINT employee_salary_components_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
  CONSTRAINT employee_salary_components_component_type_check CHECK ((component_type IN ('earning', 'deduction'))),
  CONSTRAINT employee_salary_components_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payroll_runs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payroll_runs_code_key (code),
  KEY ix_payroll_runs_campus_code (campus_code),
  CONSTRAINT payroll_runs_check CHECK ((period_end >= period_start)),
  CONSTRAINT payroll_runs_status_check CHECK ((status IN ('draft', 'pending', 'calculated', 'published', 'approved', 'paid'))),
  CONSTRAINT payroll_runs_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payslips (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  payroll_run_code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  gross_amount DECIMAL(14,2) NOT NULL,
  deduction_amount DECIMAL(14,2) NOT NULL,
  net_amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payslips_code_key (code),
  UNIQUE KEY payslips_payroll_run_code_employee_code_key (payroll_run_code, employee_code),
  KEY ix_payslips_employee_code (employee_code),
  KEY ix_payslips_payroll_run_code (payroll_run_code),
  CONSTRAINT payslips_check CHECK ((net_amount = (gross_amount - deduction_amount))),
  CONSTRAINT payslips_deduction_amount_check CHECK ((deduction_amount >= (0))),
  CONSTRAINT payslips_gross_amount_check CHECK ((gross_amount >= (0))),
  CONSTRAINT payslips_net_amount_check CHECK ((net_amount >= (0))),
  CONSTRAINT payslips_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT payslips_payroll_run_code_fkey FOREIGN KEY (payroll_run_code) REFERENCES payroll_runs (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payslip_lines (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  payslip_code VARCHAR(100) NOT NULL,
  component TEXT NOT NULL,
  component_type VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payslip_lines_code_key (code),
  KEY ix_payslip_lines_payslip_code (payslip_code),
  CONSTRAINT payslip_lines_amount_check CHECK ((amount >= (0))),
  CONSTRAINT payslip_lines_component_type_check CHECK ((component_type IN ('earning', 'deduction'))),
  CONSTRAINT payslip_lines_payslip_code_fkey FOREIGN KEY (payslip_code) REFERENCES payslips (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE exams (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  semester_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  exam_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY exams_code_key (code),
  KEY ix_exams_semester_code (semester_code),
  CONSTRAINT exams_check CHECK ((end_date >= start_date)),
  CONSTRAINT exams_exam_type_check CHECK ((exam_type IN ('internal', 'semester', 'practical', 'supplementary'))),
  CONSTRAINT exams_semester_code_fkey FOREIGN KEY (semester_code) REFERENCES semesters (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE exam_papers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  exam_code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  room_code VARCHAR(100) NULL,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_marks DECIMAL(12,2) NOT NULL,
  pass_marks DECIMAL(12,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY exam_papers_code_key (code),
  KEY ix_exam_papers_exam_code (exam_code),
  KEY ix_exam_papers_offering_code (offering_code),
  KEY ix_exam_papers_room_code (room_code),
  CONSTRAINT exam_papers_check CHECK (((max_marks > (0)) AND (pass_marks <= max_marks))),
  CONSTRAINT exam_papers_check1 CHECK ((end_time > start_time)),
  CONSTRAINT exam_papers_max_marks_check CHECK ((max_marks >= (0))),
  CONSTRAINT exam_papers_pass_marks_check CHECK ((pass_marks >= (0))),
  CONSTRAINT exam_papers_exam_code_fkey FOREIGN KEY (exam_code) REFERENCES exams (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT exam_papers_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT exam_papers_room_code_fkey FOREIGN KEY (room_code) REFERENCES rooms (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE exam_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  paper_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  marks DECIMAL(12,2) NULL,
  is_absent BOOLEAN NOT NULL,
  grade TEXT NULL,
  published BOOLEAN NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY exam_results_code_key (code),
  UNIQUE KEY exam_results_paper_code_student_code_key (paper_code, student_code),
  KEY ix_exam_results_paper_code (paper_code),
  KEY ix_exam_results_student_code (student_code),
  CONSTRAINT exam_results_check CHECK (((NOT is_absent) OR (marks IS NULL))),
  CONSTRAINT exam_results_marks_check CHECK ((marks >= (0))),
  CONSTRAINT exam_results_paper_code_fkey FOREIGN KEY (paper_code) REFERENCES exam_papers (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT exam_results_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE assignments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NULL,
  due_at DATETIME(6) NOT NULL,
  max_marks DECIMAL(12,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY assignments_code_key (code),
  KEY ix_assignments_offering_code (offering_code),
  CONSTRAINT assignments_max_marks_check CHECK ((max_marks >= (0))),
  CONSTRAINT assignments_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE assignment_submissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  assignment_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  submitted_at DATETIME(6) NULL,
  document_url TEXT NULL,
  marks DECIMAL(12,2) NULL,
  feedback TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY assignment_submissions_assignment_code_student_code_key (assignment_code, student_code),
  UNIQUE KEY assignment_submissions_code_key (code),
  KEY ix_assignment_submissions_assignment_code (assignment_code),
  KEY ix_assignment_submissions_student_code (student_code),
  CONSTRAINT assignment_submissions_marks_check CHECK ((marks >= (0))),
  CONSTRAINT assignment_submissions_assignment_code_fkey FOREIGN KEY (assignment_code) REFERENCES assignments (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT assignment_submissions_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE learning_resources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  offering_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  resource_url TEXT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY learning_resources_code_key (code),
  KEY ix_learning_resources_offering_code (offering_code),
  CONSTRAINT learning_resources_resource_type_check CHECK ((resource_type IN ('document', 'video', 'link', 'other'))),
  CONSTRAINT learning_resources_offering_code_fkey FOREIGN KEY (offering_code) REFERENCES subject_offerings (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostels (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  warden_employee_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY hostels_code_key (code),
  KEY ix_hostels_campus_code (campus_code),
  KEY ix_hostels_warden_employee_code (warden_employee_code),
  CONSTRAINT hostels_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT hostels_warden_employee_code_fkey FOREIGN KEY (warden_employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostel_rooms (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  hostel_code VARCHAR(100) NOT NULL,
  room_number VARCHAR(100) NOT NULL,
  capacity INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY hostel_rooms_code_key (code),
  UNIQUE KEY hostel_rooms_hostel_code_room_number_key (hostel_code, room_number),
  KEY ix_hostel_rooms_hostel_code (hostel_code),
  CONSTRAINT hostel_rooms_capacity_check CHECK ((capacity > 0)),
  CONSTRAINT hostel_rooms_hostel_code_fkey FOREIGN KEY (hostel_code) REFERENCES hostels (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostel_beds (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  room_code VARCHAR(100) NOT NULL,
  bed_number VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY hostel_beds_code_key (code),
  UNIQUE KEY hostel_beds_room_code_bed_number_key (room_code, bed_number),
  KEY ix_hostel_beds_room_code (room_code),
  CONSTRAINT hostel_beds_room_code_fkey FOREIGN KEY (room_code) REFERENCES hostel_rooms (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostel_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  bed_code VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_active_hostel_bed_bed_code VARCHAR(100) GENERATED ALWAYS AS (IF((end_date IS NULL), bed_code, NULL)) STORED,
  uqk_uq_active_student_hostel_student_code VARCHAR(100) GENERATED ALWAYS AS (IF((end_date IS NULL), student_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY hostel_allocations_code_key (code),
  KEY ix_hostel_allocations_bed_code (bed_code),
  KEY ix_hostel_allocations_student_code (student_code),
  UNIQUE KEY uq_active_hostel_bed (uqk_uq_active_hostel_bed_bed_code),
  UNIQUE KEY uq_active_student_hostel (uqk_uq_active_student_hostel_student_code),
  CONSTRAINT hostel_allocations_check CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT hostel_allocations_bed_code_fkey FOREIGN KEY (bed_code) REFERENCES hostel_beds (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT hostel_allocations_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostel_permissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  leave_at DATETIME(6) NOT NULL,
  return_at DATETIME(6) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  approved_by_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  pickup_person_name TEXT NULL,
  pickup_relationship TEXT NULL,
  pickup_contact VARCHAR(40) NULL,
  approved_at DATETIME(6) NULL,
  departed_at DATETIME(6) NULL,
  returned_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY hostel_permissions_code_key (code),
  KEY ix_hostel_permissions_approved_by_code (approved_by_code),
  KEY ix_hostel_permissions_student_code (student_code),
  CONSTRAINT ck_hostel_approved_actor CHECK (((status NOT IN ('approved', 'returned')) OR ((approved_by_code IS NOT NULL) AND (approved_at IS NOT NULL)))),
  CONSTRAINT ck_hostel_pickup_details CHECK (((pickup_relationship IS NULL) OR (pickup_relationship = 'self') OR (pickup_person_name IS NOT NULL))),
  CONSTRAINT ck_hostel_return_time CHECK (((returned_at IS NULL) OR ((departed_at IS NOT NULL) AND (returned_at >= departed_at)))),
  CONSTRAINT hostel_permissions_check CHECK ((return_at > leave_at)),
  CONSTRAINT hostel_permissions_status_check CHECK ((status IN ('requested', 'pending', 'approved', 'rejected', 'departed', 'returned'))),
  CONSTRAINT hostel_permissions_approved_by_code_fkey FOREIGN KEY (approved_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT hostel_permissions_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vehicles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  capacity INT NOT NULL,
  driver_employee_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vehicles_code_key (code),
  UNIQUE KEY vehicles_registration_number_key (registration_number),
  KEY ix_vehicles_campus_code (campus_code),
  KEY ix_vehicles_driver_employee_code (driver_employee_code),
  CONSTRAINT vehicles_capacity_check CHECK ((capacity > 0)),
  CONSTRAINT vehicles_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT vehicles_driver_employee_code_fkey FOREIGN KEY (driver_employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE transport_routes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  vehicle_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY transport_routes_code_key (code),
  KEY ix_transport_routes_campus_code (campus_code),
  KEY ix_transport_routes_vehicle_code (vehicle_code),
  CONSTRAINT transport_routes_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT transport_routes_vehicle_code_fkey FOREIGN KEY (vehicle_code) REFERENCES vehicles (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE transport_stops (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  route_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  sequence_number INT NOT NULL,
  pickup_time TIME NULL,
  drop_time TIME NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY transport_stops_code_key (code),
  UNIQUE KEY transport_stops_route_code_sequence_number_key (route_code, sequence_number),
  KEY ix_transport_stops_route_code (route_code),
  CONSTRAINT transport_stops_sequence_number_check CHECK ((sequence_number > 0)),
  CONSTRAINT transport_stops_route_code_fkey FOREIGN KEY (route_code) REFERENCES transport_routes (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE transport_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  stop_code VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_active_transport_student_code VARCHAR(100) GENERATED ALWAYS AS (IF((end_date IS NULL), student_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY transport_allocations_code_key (code),
  KEY ix_transport_allocations_stop_code (stop_code),
  KEY ix_transport_allocations_student_code (student_code),
  UNIQUE KEY uq_active_transport (uqk_uq_active_transport_student_code),
  CONSTRAINT transport_allocations_check CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT transport_allocations_stop_code_fkey FOREIGN KEY (stop_code) REFERENCES transport_stops (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT transport_allocations_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE library_books (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  author TEXT NULL,
  isbn VARCHAR(100) NULL,
  publisher TEXT NULL,
  category TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY library_books_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE library_copies (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  book_code VARCHAR(100) NOT NULL,
  accession_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY library_copies_accession_number_key (accession_number),
  UNIQUE KEY library_copies_code_key (code),
  KEY ix_library_copies_book_code (book_code),
  CONSTRAINT library_copies_status_check CHECK ((status IN ('available', 'issued', 'lost', 'damaged'))),
  CONSTRAINT library_copies_book_code_fkey FOREIGN KEY (book_code) REFERENCES library_books (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE library_loans (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  copy_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NULL,
  employee_code VARCHAR(100) NULL,
  issued_on DATE NOT NULL,
  due_on DATE NOT NULL,
  returned_on DATE NULL,
  fine_amount DECIMAL(14,2) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_open_library_copy_copy_code VARCHAR(100) GENERATED ALWAYS AS (IF((returned_on IS NULL), copy_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY library_loans_code_key (code),
  KEY ix_library_loans_copy_code (copy_code),
  KEY ix_library_loans_employee_code (employee_code),
  KEY ix_library_loans_student_code (student_code),
  UNIQUE KEY uq_open_library_copy (uqk_uq_open_library_copy_copy_code),
  CONSTRAINT library_loans_check CHECK (((student_code IS NULL) <> (employee_code IS NULL))),
  CONSTRAINT library_loans_check1 CHECK ((due_on >= issued_on)),
  CONSTRAINT library_loans_check2 CHECK (((returned_on IS NULL) OR (returned_on >= issued_on))),
  CONSTRAINT library_loans_fine_amount_check CHECK ((fine_amount >= (0))),
  CONSTRAINT library_loans_copy_code_fkey FOREIGN KEY (copy_code) REFERENCES library_copies (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT library_loans_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT library_loans_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE inventory_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit TEXT NOT NULL,
  room_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY inventory_items_code_key (code),
  KEY ix_inventory_items_campus_code (campus_code),
  KEY ix_inventory_items_room_code (room_code),
  CONSTRAINT inventory_items_quantity_check CHECK ((quantity >= (0))),
  CONSTRAINT inventory_items_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT inventory_items_room_code_fkey FOREIGN KEY (room_code) REFERENCES rooms (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE inventory_movements (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  movement_date DATE NOT NULL,
  employee_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY inventory_movements_code_key (code),
  KEY ix_inventory_movements_employee_code (employee_code),
  KEY ix_inventory_movements_item_code (item_code),
  CONSTRAINT inventory_movements_movement_type_check CHECK ((movement_type IN ('received', 'issued', 'returned', 'disposed'))),
  CONSTRAINT inventory_movements_quantity_check CHECK ((quantity >= (0))),
  CONSTRAINT inventory_movements_quantity_check1 CHECK ((quantity > (0))),
  CONSTRAINT inventory_movements_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT inventory_movements_item_code_fkey FOREIGN KEY (item_code) REFERENCES inventory_items (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE certificate_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  template_reference TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY certificate_types_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE certificate_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  type_code VARCHAR(100) NOT NULL,
  requested_on DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY certificate_requests_code_key (code),
  KEY ix_certificate_requests_student_code (student_code),
  KEY ix_certificate_requests_type_code (type_code),
  CONSTRAINT certificate_requests_status_check CHECK ((status IN ('pending', 'approved', 'rejected', 'issued'))),
  CONSTRAINT certificate_requests_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT certificate_requests_type_code_fkey FOREIGN KEY (type_code) REFERENCES certificate_types (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE certificates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  request_code VARCHAR(100) NOT NULL,
  certificate_number VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  issued_by_code VARCHAR(100) NOT NULL,
  verification_token VARCHAR(100) NOT NULL,
  document_url TEXT NULL,
  revoked_on DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  storage_key VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY certificates_certificate_number_key (certificate_number),
  UNIQUE KEY certificates_code_key (code),
  UNIQUE KEY certificates_request_code_key (request_code),
  UNIQUE KEY certificates_verification_token_key (verification_token),
  KEY ix_certificates_issued_by_code (issued_by_code),
  KEY ix_certificates_request_code (request_code),
  CONSTRAINT certificates_issued_by_code_fkey FOREIGN KEY (issued_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT certificates_request_code_fkey FOREIGN KEY (request_code) REFERENCES certificate_requests (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  email VARCHAR(254) NULL,
  password_hash TEXT NOT NULL,
  student_code VARCHAR(100) NULL,
  parent_code VARCHAR(100) NULL,
  employee_code VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  login_id VARCHAR(120) NOT NULL,
  allowed_clients JSON NOT NULL DEFAULT (JSON_ARRAY()),
  PRIMARY KEY (id),
  UNIQUE KEY users_code_key (code),
  UNIQUE KEY users_email_key (email),
  UNIQUE KEY users_login_id_key (login_id),
  KEY ix_users_employee_code (employee_code),
  KEY ix_users_parent_code (parent_code),
  KEY ix_users_student_code (student_code),
  CONSTRAINT users_check CHECK ((((student_code IS NOT NULL) + (parent_code IS NOT NULL) + (employee_code IS NOT NULL)) <= 1)),
  CONSTRAINT users_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT users_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT users_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  scope VARCHAR(50) NOT NULL DEFAULT 'college',
  is_system_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_protected BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY roles_code_key (code),
  UNIQUE KEY roles_name_key (name),
  CONSTRAINT roles_scope_check CHECK ((scope IN ('college', 'teaching', 'self')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE permissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY permissions_code_key (code),
  UNIQUE KEY permissions_name_key (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE user_roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  role_code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY user_roles_code_key (code),
  UNIQUE KEY user_roles_user_code_role_code_campus_code_key (user_code, role_code, campus_code),
  KEY ix_user_roles_campus_code (campus_code),
  KEY ix_user_roles_role_code (role_code),
  KEY ix_user_roles_user_code (user_code),
  CONSTRAINT user_roles_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT user_roles_role_code_fkey FOREIGN KEY (role_code) REFERENCES roles (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT user_roles_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE role_permissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  role_code VARCHAR(100) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY role_permissions_code_key (code),
  UNIQUE KEY role_permissions_role_code_permission_code_key (role_code, permission_code),
  KEY ix_role_permissions_permission_code (permission_code),
  KEY ix_role_permissions_role_code (role_code),
  CONSTRAINT role_permissions_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES permissions (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT role_permissions_role_code_fkey FOREIGN KEY (role_code) REFERENCES roles (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refresh_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  family_code VARCHAR(100) NOT NULL,
  client_id VARCHAR(50) NOT NULL,
  used_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY refresh_tokens_code_key (code),
  UNIQUE KEY refresh_tokens_token_hash_key (token_hash),
  KEY ix_refresh_tokens_family_code (family_code),
  KEY ix_refresh_tokens_user_code (user_code),
  CONSTRAINT refresh_tokens_client_id_check CHECK ((client_id IN ('admin-web', 'admin-mobile', 'teacher-mobile', 'parent-mobile', 'student-mobile'))),
  CONSTRAINT refresh_tokens_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE password_reset_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY password_reset_tokens_code_key (code),
  UNIQUE KEY password_reset_tokens_token_hash_key (token_hash),
  KEY ix_password_reset_tokens_user_code (user_code),
  CONSTRAINT password_reset_tokens_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE device_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  token VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  last_seen_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY device_tokens_code_key (code),
  UNIQUE KEY device_tokens_token_key (token),
  KEY ix_device_tokens_user_code (user_code),
  CONSTRAINT device_tokens_platform_check CHECK ((platform IN ('android', 'ios', 'web'))),
  CONSTRAINT device_tokens_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE announcements (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at DATETIME(6) NULL,
  author_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY announcements_code_key (code),
  KEY ix_announcements_author_code (author_code),
  KEY ix_announcements_campus_code (campus_code),
  CONSTRAINT announcements_author_code_fkey FOREIGN KEY (author_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT announcements_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE announcement_recipients (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  announcement_code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  read_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY announcement_recipients_announcement_code_user_code_key (announcement_code, user_code),
  UNIQUE KEY announcement_recipients_code_key (code),
  KEY ix_announcement_recipients_announcement_code (announcement_code),
  KEY ix_announcement_recipients_user_code (user_code),
  CONSTRAINT announcement_recipients_announcement_code_fkey FOREIGN KEY (announcement_code) REFERENCES announcements (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT announcement_recipients_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  sent_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY notifications_code_key (code),
  KEY ix_notifications_user_code (user_code),
  CONSTRAINT notifications_channel_check CHECK ((channel IN ('in_app', 'email', 'sms', 'push'))),
  CONSTRAINT notifications_status_check CHECK ((status IN ('queued', 'sent', 'failed', 'read'))),
  CONSTRAINT notifications_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE message_threads (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  subject TEXT NOT NULL,
  created_by_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY message_threads_code_key (code),
  KEY ix_message_threads_created_by_code (created_by_code),
  CONSTRAINT message_threads_created_by_code_fkey FOREIGN KEY (created_by_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE thread_members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  thread_code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY thread_members_code_key (code),
  UNIQUE KEY thread_members_thread_code_user_code_key (thread_code, user_code),
  KEY ix_thread_members_thread_code (thread_code),
  KEY ix_thread_members_user_code (user_code),
  CONSTRAINT thread_members_thread_code_fkey FOREIGN KEY (thread_code) REFERENCES message_threads (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT thread_members_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  thread_code VARCHAR(100) NOT NULL,
  sender_code VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  sent_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY messages_code_key (code),
  KEY ix_messages_sender_code (sender_code),
  KEY ix_messages_thread_code (thread_code),
  CONSTRAINT messages_sender_code_fkey FOREIGN KEY (sender_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT messages_thread_code_fkey FOREIGN KEY (thread_code) REFERENCES message_threads (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE calendar_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  starts_at DATETIME(6) NOT NULL,
  ends_at DATETIME(6) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY calendar_events_code_key (code),
  KEY ix_calendar_events_campus_code (campus_code),
  CONSTRAINT calendar_events_check CHECK ((ends_at >= starts_at)),
  CONSTRAINT calendar_events_event_type_check CHECK ((event_type IN ('holiday', 'academic', 'cultural', 'sports', 'meeting'))),
  CONSTRAINT calendar_events_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE placement_companies (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  contact_email VARCHAR(254) NULL,
  website TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY placement_companies_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE placement_drives (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  company_code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  job_title TEXT NOT NULL,
  drive_date DATE NOT NULL,
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY placement_drives_code_key (code),
  KEY ix_placement_drives_campus_code (campus_code),
  KEY ix_placement_drives_company_code (company_code),
  CONSTRAINT placement_drives_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT placement_drives_company_code_fkey FOREIGN KEY (company_code) REFERENCES placement_companies (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE placement_applications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  drive_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY placement_applications_code_key (code),
  UNIQUE KEY placement_applications_drive_code_student_code_key (drive_code, student_code),
  KEY ix_placement_applications_drive_code (drive_code),
  KEY ix_placement_applications_student_code (student_code),
  CONSTRAINT placement_applications_status_check CHECK ((status IN ('applied', 'shortlisted', 'selected', 'rejected', 'joined'))),
  CONSTRAINT placement_applications_drive_code_fkey FOREIGN KEY (drive_code) REFERENCES placement_drives (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT placement_applications_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE grievances (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  assigned_employee_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY grievances_code_key (code),
  KEY ix_grievances_assigned_employee_code (assigned_employee_code),
  KEY ix_grievances_user_code (user_code),
  CONSTRAINT grievances_status_check CHECK ((status IN ('open', 'in_progress', 'resolved', 'closed'))),
  CONSTRAINT grievances_assigned_employee_code_fkey FOREIGN KEY (assigned_employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT grievances_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE documents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NULL,
  employee_code VARCHAR(100) NULL,
  parent_code VARCHAR(100) NULL,
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  verified_by_code VARCHAR(100) NULL,
  verified_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY documents_code_key (code),
  KEY ix_documents_employee_code (employee_code),
  KEY ix_documents_parent_code (parent_code),
  KEY ix_documents_student_code (student_code),
  KEY ix_documents_verified_by_code (verified_by_code),
  CONSTRAINT documents_check CHECK ((((student_code IS NOT NULL) + (employee_code IS NOT NULL) + (parent_code IS NOT NULL)) = 1)),
  CONSTRAINT documents_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT documents_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT documents_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT documents_verified_by_code_fkey FOREIGN KEY (verified_by_code) REFERENCES employees (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE consents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  parent_code VARCHAR(100) NULL,
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at DATETIME(6) NOT NULL,
  withdrawn_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consents_code_key (code),
  KEY ix_consents_parent_code (parent_code),
  KEY ix_consents_student_code (student_code),
  CONSTRAINT consents_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT consents_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE import_jobs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  uploaded_by_code VARCHAR(100) NOT NULL,
  filename TEXT NOT NULL,
  file_sha256 VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_rows INT NOT NULL,
  successful_rows INT NOT NULL,
  failed_rows INT NOT NULL,
  finished_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  contract_version VARCHAR(255) NOT NULL DEFAULT '2.0',
  reviewed_by_user_code VARCHAR(100) NULL,
  approved_at DATETIME(6) NULL,
  errors JSON NULL,
  staged_rows JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY import_jobs_code_key (code),
  KEY ix_import_jobs_uploaded_by_code (uploaded_by_code),
  CONSTRAINT import_jobs_check CHECK (((successful_rows + failed_rows) <= total_rows)),
  CONSTRAINT import_jobs_failed_rows_check CHECK ((failed_rows >= 0)),
  CONSTRAINT import_jobs_status_check CHECK ((status IN ('uploaded', 'validated', 'committed', 'failed'))),
  CONSTRAINT import_jobs_successful_rows_check CHECK ((successful_rows >= 0)),
  CONSTRAINT import_jobs_total_rows_check CHECK ((total_rows >= 0)),
  CONSTRAINT import_jobs_reviewed_by_user_code_fkey FOREIGN KEY (reviewed_by_user_code) REFERENCES users (code),
  CONSTRAINT import_jobs_uploaded_by_code_fkey FOREIGN KEY (uploaded_by_code) REFERENCES users (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE import_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  job_code VARCHAR(100) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  `row_number` INT NOT NULL,
  entity_code VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL,
  error_details JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  raw_data JSON NOT NULL DEFAULT (JSON_OBJECT()),
  mapped_data JSON NULL,
  source_headers JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY import_rows_code_key (code),
  UNIQUE KEY import_rows_job_code_sheet_name_row_number_key (job_code, sheet_name, `row_number`),
  KEY ix_import_rows_job_code (job_code),
  CONSTRAINT import_rows_row_number_check CHECK ((`row_number` > 0)),
  CONSTRAINT import_rows_status_check CHECK ((status IN ('pending', 'valid', 'invalid', 'imported'))),
  CONSTRAINT import_rows_job_code_fkey FOREIGN KEY (job_code) REFERENCES import_jobs (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  actor_code VARCHAR(100) NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_code VARCHAR(100) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip_address TEXT NULL,
  occurred_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY audit_logs_code_key (code),
  KEY ix_audit_logs_actor_code (actor_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE institution_settings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  institution_code VARCHAR(100) NOT NULL,
  setting_key VARCHAR(255) NOT NULL,
  setting_value JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY institution_settings_code_key (code),
  UNIQUE KEY institution_settings_institution_code_setting_key_key (institution_code, setting_key),
  KEY ix_institution_settings_institution_code (institution_code),
  CONSTRAINT institution_settings_institution_code_fkey FOREIGN KEY (institution_code) REFERENCES institutions (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE website_pages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  institution_code VARCHAR(100) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  content JSON NOT NULL,
  published BOOLEAN NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY website_pages_code_key (code),
  UNIQUE KEY website_pages_institution_code_slug_key (institution_code, slug),
  KEY ix_website_pages_institution_code (institution_code),
  CONSTRAINT website_pages_institution_code_fkey FOREIGN KEY (institution_code) REFERENCES institutions (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE contact_enquiries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  institution_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY contact_enquiries_code_key (code),
  KEY ix_contact_enquiries_institution_code (institution_code),
  CONSTRAINT contact_enquiries_status_check CHECK ((status IN ('new', 'responded', 'closed'))),
  CONSTRAINT contact_enquiries_institution_code_fkey FOREIGN KEY (institution_code) REFERENCES institutions (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_sources_code_key (code),
  CONSTRAINT admission_sources_channel_check CHECK ((channel IN ('reference', 'social_media', 'walk_in', 'website', 'campaign', 'other')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_cycles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  opens_on DATE NOT NULL,
  closes_on DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_cycles_code_key (code),
  KEY ix_admission_cycles_academic_year_code (academic_year_code),
  KEY ix_admission_cycles_campus_code (campus_code),
  CONSTRAINT admission_cycles_check CHECK ((closes_on >= opens_on)),
  CONSTRAINT admission_cycles_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code),
  CONSTRAINT admission_cycles_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_enquiries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  source_code VARCHAR(100) NOT NULL,
  cycle_code VARCHAR(100) NULL,
  program_code VARCHAR(100) NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(254) NULL,
  parent_name TEXT NULL,
  parent_phone VARCHAR(40) NULL,
  referrer_name TEXT NULL,
  campaign_reference TEXT NULL,
  assigned_employee_code VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  next_follow_up_at DATETIME(6) NULL,
  communication_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_recorded_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_enquiries_code_key (code),
  KEY ix_admission_enquiries_assigned_employee_code (assigned_employee_code),
  KEY ix_admission_enquiries_campus_code (campus_code),
  KEY ix_admission_enquiries_cycle_code (cycle_code),
  KEY ix_admission_enquiries_program_code (program_code),
  KEY ix_admission_enquiries_source_code (source_code),
  CONSTRAINT admission_enquiries_check CHECK (((NOT communication_consent) OR (consent_recorded_at IS NOT NULL))),
  CONSTRAINT admission_enquiries_status_check CHECK ((status IN ('new', 'contacted', 'counselling', 'applied', 'closed', 'not_interested'))),
  CONSTRAINT admission_enquiries_assigned_employee_code_fkey FOREIGN KEY (assigned_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_enquiries_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code),
  CONSTRAINT admission_enquiries_cycle_code_fkey FOREIGN KEY (cycle_code) REFERENCES admission_cycles (code),
  CONSTRAINT admission_enquiries_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code),
  CONSTRAINT admission_enquiries_source_code_fkey FOREIGN KEY (source_code) REFERENCES admission_sources (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE enquiry_followups (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  enquiry_code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  outcome TEXT NOT NULL,
  notes TEXT NULL,
  next_follow_up_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY enquiry_followups_code_key (code),
  KEY ix_enquiry_followups_employee_code (employee_code),
  KEY ix_enquiry_followups_enquiry_code (enquiry_code),
  CONSTRAINT enquiry_followups_channel_check CHECK ((channel IN ('call', 'sms', 'email', 'visit', 'other'))),
  CONSTRAINT enquiry_followups_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code),
  CONSTRAINT enquiry_followups_enquiry_code_fkey FOREIGN KEY (enquiry_code) REFERENCES admission_enquiries (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE application_guardians (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(254) NULL,
  occupation TEXT NULL,
  address JSON NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  parent_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_application_primary_guardian_application_code VARCHAR(100) GENERATED ALWAYS AS (IF(is_primary, application_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY application_guardians_code_key (code),
  KEY ix_application_guardians_application_code (application_code),
  KEY ix_application_guardians_parent_code (parent_code),
  UNIQUE KEY uq_application_primary_guardian (uqk_uq_application_primary_guardian_application_code),
  CONSTRAINT application_guardians_relationship_check CHECK ((relationship IN ('father', 'mother', 'guardian', 'other'))),
  CONSTRAINT application_guardians_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code),
  CONSTRAINT application_guardians_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE application_qualifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  qualification TEXT NOT NULL,
  institution TEXT NOT NULL,
  board_university TEXT NULL,
  passing_year INT NULL,
  registration_number VARCHAR(100) NULL,
  score DECIMAL(8,2) NULL,
  score_scale VARCHAR(50) NULL,
  maximum_score DECIMAL(8,2) NULL,
  result_status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY application_qualifications_code_key (code),
  KEY ix_application_qualifications_application_code (application_code),
  CONSTRAINT application_qualifications_check CHECK (((maximum_score IS NULL) OR (score <= maximum_score))),
  CONSTRAINT application_qualifications_passing_year_check CHECK (((passing_year >= 1900) AND (passing_year <= 2200))),
  CONSTRAINT application_qualifications_result_status_check CHECK ((result_status IN ('passed', 'awaiting', 'failed'))),
  CONSTRAINT application_qualifications_score_check CHECK ((score >= (0))),
  CONSTRAINT application_qualifications_score_scale_check CHECK ((score_scale IN ('percentage', 'cgpa_10', 'gpa_4', 'other'))),
  CONSTRAINT application_qualifications_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE document_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  accepted_mime_types JSON NOT NULL DEFAULT (JSON_ARRAY('application/pdf', 'image/jpeg', 'image/png')),
  maximum_file_bytes BIGINT NOT NULL DEFAULT 10485760,
  expiry_required BOOLEAN NOT NULL DEFAULT FALSE,
  original_sighting_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY document_types_code_key (code),
  CONSTRAINT document_types_maximum_file_bytes_check CHECK ((maximum_file_bytes > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE program_document_requirements (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  document_type_code VARCHAR(100) NOT NULL,
  admission_category VARCHAR(50) NOT NULL DEFAULT 'all',
  required_stage VARCHAR(50) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  waiver_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  instructions TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY program_document_requirements_code_key (code),
  UNIQUE KEY program_document_requirements_program_code_academic_year_co_key (program_code, academic_year_code, document_type_code, admission_category, required_stage),
  KEY ix_program_document_requirements_academic_year_code (academic_year_code),
  KEY ix_program_document_requirements_document_type_code (document_type_code),
  KEY ix_program_document_requirements_program_code (program_code),
  CONSTRAINT program_document_requirements_admission_category_check CHECK ((admission_category IN ('all', 'regular', 'lateral_entry', 'transfer', 'readmission'))),
  CONSTRAINT program_document_requirements_required_stage_check CHECK ((required_stage IN ('submission', 'offer', 'enrollment'))),
  CONSTRAINT program_document_requirements_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code),
  CONSTRAINT program_document_requirements_document_type_code_fkey FOREIGN KEY (document_type_code) REFERENCES document_types (code),
  CONSTRAINT program_document_requirements_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_documents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  document_type_code VARCHAR(100) NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  storage_key VARCHAR(255) NULL,
  original_filename TEXT NULL,
  mime_type TEXT NULL,
  size_bytes BIGINT NULL,
  sha256 CHAR(64) NULL,
  issued_on DATE NULL,
  expires_on DATE NULL,
  uploaded_by_user_code VARCHAR(100) NULL,
  received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  received_by_employee_code VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL,
  original_sighted BOOLEAN NOT NULL DEFAULT FALSE,
  original_sighted_by_code VARCHAR(100) NULL,
  original_sighted_at DATETIME(6) NULL,
  reviewed_by_employee_code VARCHAR(100) NULL,
  reviewed_at DATETIME(6) NULL,
  review_notes TEXT NULL,
  waiver_reason TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_current_admission_document_application_code VARCHAR(100) GENERATED ALWAYS AS (IF(is_current, application_code, NULL)) STORED,
  uqk_uq_current_admission_document_document_type_code VARCHAR(100) GENERATED ALWAYS AS (IF(is_current, document_type_code, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY admission_documents_application_code_document_type_code_rev_key (application_code, document_type_code, revision),
  UNIQUE KEY admission_documents_code_key (code),
  UNIQUE KEY admission_documents_storage_key_key (storage_key),
  KEY ix_admission_documents_application_code (application_code),
  KEY ix_admission_documents_document_type_code (document_type_code),
  KEY ix_admission_documents_original_sighted_by_code (original_sighted_by_code),
  KEY ix_admission_documents_received_by_employee_code (received_by_employee_code),
  KEY ix_admission_documents_reviewed_by_employee_code (reviewed_by_employee_code),
  KEY ix_admission_documents_uploaded_by_user_code (uploaded_by_user_code),
  UNIQUE KEY uq_current_admission_document (uqk_uq_current_admission_document_application_code, uqk_uq_current_admission_document_document_type_code),
  CONSTRAINT admission_documents_check CHECK (((expires_on IS NULL) OR (issued_on IS NULL) OR (expires_on >= issued_on))),
  CONSTRAINT admission_documents_check1 CHECK (((NOT original_sighted) OR ((original_sighted_by_code IS NOT NULL) AND (original_sighted_at IS NOT NULL)))),
  CONSTRAINT admission_documents_check2 CHECK (((status NOT IN ('verified', 'rejected', 'waived')) OR ((reviewed_by_employee_code IS NOT NULL) AND (reviewed_at IS NOT NULL)))),
  CONSTRAINT admission_documents_check3 CHECK (((status <> 'waived') OR (COALESCE(CHAR_LENGTH(TRIM(waiver_reason)), 0) > 0))),
  CONSTRAINT admission_documents_check4 CHECK (((status = 'waived') OR ((storage_key IS NOT NULL) AND (original_filename IS NOT NULL) AND (mime_type IS NOT NULL) AND (size_bytes IS NOT NULL) AND (sha256 IS NOT NULL)))),
  CONSTRAINT admission_documents_revision_check CHECK ((revision > 0)),
  CONSTRAINT admission_documents_sha256_check CHECK (REGEXP_LIKE(sha256, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT admission_documents_size_bytes_check CHECK ((size_bytes > 0)),
  CONSTRAINT admission_documents_status_check CHECK ((status IN ('received', 'pending_verification', 'verified', 'rejected', 'waived'))),
  CONSTRAINT admission_documents_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code),
  CONSTRAINT admission_documents_document_type_code_fkey FOREIGN KEY (document_type_code) REFERENCES document_types (code),
  CONSTRAINT admission_documents_original_sighted_by_code_fkey FOREIGN KEY (original_sighted_by_code) REFERENCES employees (code),
  CONSTRAINT admission_documents_received_by_employee_code_fkey FOREIGN KEY (received_by_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_documents_reviewed_by_employee_code_fkey FOREIGN KEY (reviewed_by_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_documents_uploaded_by_user_code_fkey FOREIGN KEY (uploaded_by_user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE document_verification_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  admission_document_code VARCHAR(100) NOT NULL,
  actor_employee_code VARCHAR(100) NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY document_verification_events_code_key (code),
  KEY ix_document_verification_events_actor_employee_code (actor_employee_code),
  KEY ix_document_verification_events_admission_document_code (admission_document_code),
  CONSTRAINT document_verification_events_actor_employee_code_fkey FOREIGN KEY (actor_employee_code) REFERENCES employees (code),
  CONSTRAINT document_verification_events_admission_document_code_fkey FOREIGN KEY (admission_document_code) REFERENCES admission_documents (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_reviews (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  reviewer_employee_code VARCHAR(100) NOT NULL,
  decision VARCHAR(50) NOT NULL,
  eligibility_notes TEXT NOT NULL,
  reviewed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_reviews_code_key (code),
  KEY ix_admission_reviews_application_code (application_code),
  KEY ix_admission_reviews_reviewer_employee_code (reviewer_employee_code),
  CONSTRAINT admission_reviews_check CHECK (((decision = 'pending') OR (reviewed_at IS NOT NULL))),
  CONSTRAINT admission_reviews_decision_check CHECK ((decision IN ('pending', 'eligible', 'ineligible', 'hold'))),
  CONSTRAINT admission_reviews_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code),
  CONSTRAINT admission_reviews_reviewer_employee_code_fkey FOREIGN KEY (reviewer_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  actor_user_code VARCHAR(100) NULL,
  reason TEXT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_status_history_code_key (code),
  KEY ix_admission_status_history_actor_user_code (actor_user_code),
  KEY ix_admission_status_history_application_code (application_code),
  CONSTRAINT admission_status_history_actor_user_code_fkey FOREIGN KEY (actor_user_code) REFERENCES users (code),
  CONSTRAINT admission_status_history_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_offers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  offer_number VARCHAR(100) NOT NULL,
  offered_program_code VARCHAR(100) NOT NULL,
  issued_by_employee_code VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  accept_by DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  accepted_at DATETIME(6) NULL,
  terms TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_offers_code_key (code),
  UNIQUE KEY admission_offers_offer_number_key (offer_number),
  KEY ix_admission_offers_application_code (application_code),
  KEY ix_admission_offers_issued_by_employee_code (issued_by_employee_code),
  KEY ix_admission_offers_offered_program_code (offered_program_code),
  CONSTRAINT admission_offers_check CHECK ((accept_by >= issued_on)),
  CONSTRAINT admission_offers_check1 CHECK (((status <> 'accepted') OR (accepted_at IS NOT NULL))),
  CONSTRAINT admission_offers_status_check CHECK ((status IN ('issued', 'accepted', 'declined', 'expired', 'withdrawn'))),
  CONSTRAINT admission_offers_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code),
  CONSTRAINT admission_offers_issued_by_employee_code_fkey FOREIGN KEY (issued_by_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_offers_offered_program_code_fkey FOREIGN KEY (offered_program_code) REFERENCES programs (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admission_enrollment_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  application_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  enrollment_code VARCHAR(100) NOT NULL,
  authorized_by_employee_code VARCHAR(100) NOT NULL,
  enrolled_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admission_enrollment_events_application_code_key (application_code),
  UNIQUE KEY admission_enrollment_events_code_key (code),
  UNIQUE KEY admission_enrollment_events_enrollment_code_key (enrollment_code),
  UNIQUE KEY admission_enrollment_events_student_code_key (student_code),
  KEY ix_admission_enrollment_events_application_code (application_code),
  KEY ix_admission_enrollment_events_authorized_by_employee_code (authorized_by_employee_code),
  KEY ix_admission_enrollment_events_enrollment_code (enrollment_code),
  KEY ix_admission_enrollment_events_student_code (student_code),
  CONSTRAINT admission_enrollment_events_application_code_fkey FOREIGN KEY (application_code) REFERENCES admission_applications (code),
  CONSTRAINT admission_enrollment_events_authorized_by_employee_code_fkey FOREIGN KEY (authorized_by_employee_code) REFERENCES employees (code),
  CONSTRAINT admission_enrollment_events_enrollment_code_fkey FOREIGN KEY (enrollment_code) REFERENCES student_enrollments (code),
  CONSTRAINT admission_enrollment_events_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  actor_user_code VARCHAR(100) NULL,
  reason TEXT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_status_history_code_key (code),
  KEY ix_student_status_history_actor_user_code (actor_user_code),
  KEY ix_student_status_history_student_code (student_code),
  CONSTRAINT student_status_history_actor_user_code_fkey FOREIGN KEY (actor_user_code) REFERENCES users (code),
  CONSTRAINT student_status_history_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE student_document_links (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  admission_document_code VARCHAR(100) NOT NULL,
  transferred_by_employee_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_document_links_code_key (code),
  UNIQUE KEY student_document_links_student_code_admission_document_code_key (student_code, admission_document_code),
  KEY ix_student_document_links_admission_document_code (admission_document_code),
  KEY ix_student_document_links_student_code (student_code),
  KEY ix_student_document_links_transferred_by_employee_code (transferred_by_employee_code),
  CONSTRAINT student_document_links_admission_document_code_fkey FOREIGN KEY (admission_document_code) REFERENCES admission_documents (code),
  CONSTRAINT student_document_links_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code),
  CONSTRAINT student_document_links_transferred_by_employee_code_fkey FOREIGN KEY (transferred_by_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE external_parties (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  party_type VARCHAR(50) NOT NULL,
  contact_email VARCHAR(254) NULL,
  ledger_reference TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY external_parties_code_key (code),
  CONSTRAINT external_parties_party_type_check CHECK ((party_type IN ('university', 'examination_board', 'government', 'other')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE charge_scholarship_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  student_scholarship_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  allocated_by_employee_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY charge_scholarship_allocation_charge_code_student_scholarsh_key (charge_code, student_scholarship_code),
  UNIQUE KEY charge_scholarship_allocations_code_key (code),
  KEY ix_charge_scholarship_allocations_allocated_by_employee_code (allocated_by_employee_code),
  KEY ix_charge_scholarship_allocations_charge_code (charge_code),
  KEY ix_charge_scholarship_allocations_student_scholarship_code (student_scholarship_code),
  CONSTRAINT charge_scholarship_allocations_amount_check CHECK ((amount > (0))),
  CONSTRAINT charge_scholarship_allocations_allocated_by_employee_code_fkey FOREIGN KEY (allocated_by_employee_code) REFERENCES employees (code),
  CONSTRAINT charge_scholarship_allocations_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code),
  CONSTRAINT charge_scholarship_allocations_student_scholarship_code_fkey FOREIGN KEY (student_scholarship_code) REFERENCES student_scholarships (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refund_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  refund_code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY refund_allocations_code_key (code),
  UNIQUE KEY refund_allocations_refund_code_charge_code_key (refund_code, charge_code),
  KEY ix_refund_allocations_charge_code (charge_code),
  KEY ix_refund_allocations_refund_code (refund_code),
  CONSTRAINT refund_allocations_amount_check CHECK ((amount > (0))),
  CONSTRAINT refund_allocations_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code),
  CONSTRAINT refund_allocations_refund_code_fkey FOREIGN KEY (refund_code) REFERENCES refunds (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE external_remittances (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  party_code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  paid_on DATE NOT NULL,
  transaction_reference TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  expense_code VARCHAR(100) NULL,
  approved_by_employee_code VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY external_remittances_code_key (code),
  UNIQUE KEY external_remittances_expense_code_key (expense_code),
  KEY ix_external_remittances_approved_by_employee_code (approved_by_employee_code),
  KEY ix_external_remittances_campus_code (campus_code),
  KEY ix_external_remittances_expense_code (expense_code),
  KEY ix_external_remittances_party_code (party_code),
  CONSTRAINT external_remittances_amount_check CHECK ((amount > (0))),
  CONSTRAINT external_remittances_status_check CHECK ((status IN ('pending', 'paid', 'failed'))),
  CONSTRAINT external_remittances_approved_by_employee_code_fkey FOREIGN KEY (approved_by_employee_code) REFERENCES employees (code),
  CONSTRAINT external_remittances_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code),
  CONSTRAINT external_remittances_expense_code_fkey FOREIGN KEY (expense_code) REFERENCES expenses (code),
  CONSTRAINT external_remittances_party_code_fkey FOREIGN KEY (party_code) REFERENCES external_parties (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE remittance_allocations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  remittance_code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY remittance_allocations_code_key (code),
  UNIQUE KEY remittance_allocations_remittance_code_charge_code_key (remittance_code, charge_code),
  KEY ix_remittance_allocations_charge_code (charge_code),
  KEY ix_remittance_allocations_remittance_code (remittance_code),
  CONSTRAINT remittance_allocations_amount_check CHECK ((amount > (0))),
  CONSTRAINT remittance_allocations_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code),
  CONSTRAINT remittance_allocations_remittance_code_fkey FOREIGN KEY (remittance_code) REFERENCES external_remittances (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payment_gateway_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_order_reference VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  payment_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payment_gateway_orders_code_key (code),
  UNIQUE KEY payment_gateway_orders_idempotency_key_key (idempotency_key),
  UNIQUE KEY payment_gateway_orders_payment_code_key (payment_code),
  UNIQUE KEY payment_gateway_orders_provider_provider_order_reference_key (provider, provider_order_reference),
  KEY ix_payment_gateway_orders_payment_code (payment_code),
  KEY ix_payment_gateway_orders_student_code (student_code),
  CONSTRAINT payment_gateway_orders_amount_check CHECK ((amount > (0))),
  CONSTRAINT payment_gateway_orders_status_check CHECK ((status IN ('created', 'pending', 'paid', 'failed', 'cancelled'))),
  CONSTRAINT payment_gateway_orders_payment_code_fkey FOREIGN KEY (payment_code) REFERENCES payments (code),
  CONSTRAINT payment_gateway_orders_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payment_gateway_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  order_code VARCHAR(100) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  processed_at DATETIME(6) NULL,
  payload_sha256 CHAR(64) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payment_gateway_events_code_key (code),
  UNIQUE KEY payment_gateway_events_provider_provider_event_id_key (provider, provider_event_id),
  KEY ix_payment_gateway_events_order_code (order_code),
  CONSTRAINT payment_gateway_events_check CHECK (((status <> 'processed') OR signature_verified)),
  CONSTRAINT payment_gateway_events_payload_sha256_check CHECK (REGEXP_LIKE(payload_sha256, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT payment_gateway_events_status_check CHECK ((status IN ('received', 'processed', 'rejected', 'failed'))),
  CONSTRAINT payment_gateway_events_order_code_fkey FOREIGN KEY (order_code) REFERENCES payment_gateway_orders (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE fee_reminder_jobs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  charge_code VARCHAR(100) NOT NULL,
  parent_code VARCHAR(100) NOT NULL,
  cutoff_date DATE NOT NULL,
  scheduled_at DATETIME(6) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  message_template TEXT NOT NULL,
  consent_checked_at DATETIME(6) NULL,
  status VARCHAR(50) NOT NULL,
  sent_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY fee_reminder_jobs_charge_code_parent_code_channel_cutoff_da_key (charge_code, parent_code, channel, cutoff_date),
  UNIQUE KEY fee_reminder_jobs_code_key (code),
  KEY ix_fee_reminder_jobs_charge_code (charge_code),
  KEY ix_fee_reminder_jobs_parent_code (parent_code),
  CONSTRAINT fee_reminder_jobs_channel_check CHECK ((channel IN ('sms', 'push', 'email'))),
  CONSTRAINT fee_reminder_jobs_check CHECK (((status <> 'sent') OR ((sent_at IS NOT NULL) AND (consent_checked_at IS NOT NULL)))),
  CONSTRAINT fee_reminder_jobs_status_check CHECK ((status IN ('queued', 'sent', 'failed', 'cancelled'))),
  CONSTRAINT fee_reminder_jobs_charge_code_fkey FOREIGN KEY (charge_code) REFERENCES student_fee_charges (code),
  CONSTRAINT fee_reminder_jobs_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES parents (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notification_delivery_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  notification_code VARCHAR(100) NULL,
  reminder_code VARCHAR(100) NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT NULL,
  attempt_number INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  error_code TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY notification_delivery_attempts_code_key (code),
  KEY ix_notification_delivery_attempts_notification_code (notification_code),
  KEY ix_notification_delivery_attempts_reminder_code (reminder_code),
  CONSTRAINT notification_delivery_attempts_attempt_number_check CHECK ((attempt_number > 0)),
  CONSTRAINT notification_delivery_attempts_check CHECK ((((notification_code IS NOT NULL) + (reminder_code IS NOT NULL)) = 1)),
  CONSTRAINT notification_delivery_attempts_status_check CHECK ((status IN ('queued', 'sent', 'delivered', 'failed'))),
  CONSTRAINT notification_delivery_attempts_notification_code_fkey FOREIGN KEY (notification_code) REFERENCES notifications (code),
  CONSTRAINT notification_delivery_attempts_reminder_code_fkey FOREIGN KEY (reminder_code) REFERENCES fee_reminder_jobs (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE certificate_download_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  certificate_code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  downloaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  channel VARCHAR(50) NOT NULL,
  document_sha256 CHAR(64) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY certificate_download_events_code_key (code),
  UNIQUE KEY certificate_download_events_request_id_key (request_id),
  KEY ix_certificate_download_events_certificate_code (certificate_code),
  KEY ix_certificate_download_events_user_code (user_code),
  CONSTRAINT certificate_download_events_channel_check CHECK ((channel IN ('web', 'parent_app', 'student_app', 'admin_app', 'admin-web', 'admin-mobile', 'teacher-mobile', 'parent-mobile', 'student-mobile'))),
  CONSTRAINT certificate_download_events_document_sha256_check CHECK (REGEXP_LIKE(document_sha256, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT certificate_download_events_certificate_code_fkey FOREIGN KEY (certificate_code) REFERENCES certificates (code),
  CONSTRAINT certificate_download_events_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE certificate_signatures (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  certificate_code VARCHAR(100) NOT NULL,
  signing_provider TEXT NOT NULL,
  key_reference TEXT NOT NULL,
  signature_algorithm TEXT NOT NULL,
  signed_document_storage_key VARCHAR(255) NOT NULL,
  document_sha256 CHAR(64) NOT NULL,
  signed_by_employee_code VARCHAR(100) NOT NULL,
  signed_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  signature TEXT NULL,
  public_key TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY certificate_signatures_certificate_code_key (certificate_code),
  UNIQUE KEY certificate_signatures_code_key (code),
  UNIQUE KEY certificate_signatures_signed_document_storage_key_key (signed_document_storage_key),
  KEY ix_certificate_signatures_certificate_code (certificate_code),
  KEY ix_certificate_signatures_signed_by_employee_code (signed_by_employee_code),
  CONSTRAINT certificate_signatures_document_sha256_check CHECK (REGEXP_LIKE(document_sha256, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT certificate_signatures_certificate_code_fkey FOREIGN KEY (certificate_code) REFERENCES certificates (code),
  CONSTRAINT certificate_signatures_signed_by_employee_code_fkey FOREIGN KEY (signed_by_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE employee_tax_documents (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  financial_year VARCHAR(9) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  storage_key VARCHAR(255) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  published_by_employee_code VARCHAR(100) NOT NULL,
  published_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY employee_tax_documents_code_key (code),
  UNIQUE KEY employee_tax_documents_employee_code_financial_year_documen_key (employee_code, financial_year, document_type, revision),
  UNIQUE KEY employee_tax_documents_storage_key_key (storage_key),
  KEY ix_employee_tax_documents_employee_code (employee_code),
  KEY ix_employee_tax_documents_published_by_employee_code (published_by_employee_code),
  CONSTRAINT employee_tax_documents_document_type_check CHECK ((document_type IN ('form_16', 'form_16a', 'other'))),
  CONSTRAINT employee_tax_documents_revision_check CHECK ((revision > 0)),
  CONSTRAINT employee_tax_documents_sha256_check CHECK (REGEXP_LIKE(sha256, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT employee_tax_documents_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code),
  CONSTRAINT employee_tax_documents_published_by_employee_code_fkey FOREIGN KEY (published_by_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE admin_mobile_preferences (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  default_campus_code VARCHAR(100) NULL,
  default_period VARCHAR(50) NOT NULL DEFAULT 'month',
  alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  report_preferences JSON NOT NULL DEFAULT (JSON_OBJECT()),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY admin_mobile_preferences_code_key (code),
  UNIQUE KEY admin_mobile_preferences_user_code_key (user_code),
  KEY ix_admin_mobile_preferences_default_campus_code (default_campus_code),
  KEY ix_admin_mobile_preferences_user_code (user_code),
  CONSTRAINT admin_mobile_preferences_default_period_check CHECK ((default_period IN ('day', 'week', 'month', 'all'))),
  CONSTRAINT admin_mobile_preferences_default_campus_code_fkey FOREIGN KEY (default_campus_code) REFERENCES campuses (code),
  CONSTRAINT admin_mobile_preferences_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE report_export_jobs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  requested_by_user_code VARCHAR(100) NOT NULL,
  campus_code VARCHAR(100) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  output_format VARCHAR(50) NOT NULL,
  filters JSON NOT NULL DEFAULT (JSON_OBJECT()),
  status VARCHAR(50) NOT NULL,
  storage_key TEXT NULL,
  sha256 CHAR(64) NULL,
  expires_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY report_export_jobs_code_key (code),
  KEY ix_report_export_jobs_campus_code (campus_code),
  KEY ix_report_export_jobs_requested_by_user_code (requested_by_user_code),
  CONSTRAINT report_export_jobs_check CHECK (((status <> 'ready') OR ((storage_key IS NOT NULL) AND (completed_at IS NOT NULL) AND (expires_at IS NOT NULL) AND (sha256 IS NOT NULL)))),
  CONSTRAINT report_export_jobs_output_format_check CHECK ((output_format IN ('pdf', 'csv', 'xlsx'))),
  CONSTRAINT report_export_jobs_report_type_check CHECK ((report_type IN ('collections', 'outstanding', 'cashbook', 'external_remittances', 'expenses', 'payroll', 'admissions'))),
  CONSTRAINT report_export_jobs_status_check CHECK ((status IN ('queued', 'processing', 'ready', 'failed', 'expired'))),
  CONSTRAINT report_export_jobs_campus_code_fkey FOREIGN KEY (campus_code) REFERENCES campuses (code),
  CONSTRAINT report_export_jobs_requested_by_user_code_fkey FOREIGN KEY (requested_by_user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE report_download_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  export_job_code VARCHAR(100) NOT NULL,
  user_code VARCHAR(100) NOT NULL,
  downloaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  request_id VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY report_download_events_code_key (code),
  UNIQUE KEY report_download_events_request_id_key (request_id),
  KEY ix_report_download_events_export_job_code (export_job_code),
  KEY ix_report_download_events_user_code (user_code),
  CONSTRAINT report_download_events_export_job_code_fkey FOREIGN KEY (export_job_code) REFERENCES report_export_jobs (code),
  CONSTRAINT report_download_events_user_code_fkey FOREIGN KEY (user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE hostel_provision_issues (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  hostel_code VARCHAR(100) NOT NULL,
  inventory_movement_code VARCHAR(100) NOT NULL,
  issued_by_employee_code VARCHAR(100) NOT NULL,
  received_by_employee_code VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY hostel_provision_issues_code_key (code),
  UNIQUE KEY hostel_provision_issues_inventory_movement_code_key (inventory_movement_code),
  KEY ix_hostel_provision_issues_hostel_code (hostel_code),
  KEY ix_hostel_provision_issues_inventory_movement_code (inventory_movement_code),
  KEY ix_hostel_provision_issues_issued_by_employee_code (issued_by_employee_code),
  KEY ix_hostel_provision_issues_received_by_employee_code (received_by_employee_code),
  CONSTRAINT hostel_provision_issues_hostel_code_fkey FOREIGN KEY (hostel_code) REFERENCES hostels (code),
  CONSTRAINT hostel_provision_issues_inventory_movement_code_fkey FOREIGN KEY (inventory_movement_code) REFERENCES inventory_movements (code),
  CONSTRAINT hostel_provision_issues_issued_by_employee_code_fkey FOREIGN KEY (issued_by_employee_code) REFERENCES employees (code),
  CONSTRAINT hostel_provision_issues_received_by_employee_code_fkey FOREIGN KEY (received_by_employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE form_definitions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  screen VARCHAR(100) NOT NULL,
  fields JSON NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  revision INT NOT NULL DEFAULT 1,
  updated_by_user_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  uqk_uq_published_form_screen_screen VARCHAR(100) GENERATED ALWAYS AS (IF(is_published, screen, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY form_definitions_code_key (code),
  KEY ix_form_definitions_updated_by_user_code (updated_by_user_code),
  UNIQUE KEY uq_published_form_screen (uqk_uq_published_form_screen_screen),
  CONSTRAINT form_definitions_revision_check CHECK ((revision > 0)),
  CONSTRAINT form_definitions_updated_by_user_code_fkey FOREIGN KEY (updated_by_user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE form_submissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  form_code VARCHAR(100) NOT NULL,
  revision INT NOT NULL,
  definition JSON NOT NULL,
  submitted_values JSON NOT NULL,
  submitted_by_user_code VARCHAR(100) NULL,
  submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  entity_code VARCHAR(100) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY form_submissions_code_key (code),
  KEY ix_form_submissions_form_code (form_code),
  KEY ix_form_submissions_submitted_by_user_code (submitted_by_user_code),
  CONSTRAINT form_submissions_revision_check CHECK ((revision > 0)),
  CONSTRAINT form_submissions_form_code_fkey FOREIGN KEY (form_code) REFERENCES form_definitions (code),
  CONSTRAINT form_submissions_submitted_by_user_code_fkey FOREIGN KEY (submitted_by_user_code) REFERENCES users (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE login_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  attempt_key VARCHAR(200) NOT NULL,
  attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY login_attempts_code_key (code),
  KEY ix_login_attempts_key_time (attempt_key, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE purchase_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  requested_on DATE NOT NULL,
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY purchase_requests_code_key (code),
  KEY ix_purchase_requests_employee_code (employee_code),
  CONSTRAINT purchase_requests_amount_check CHECK ((amount >= (0))),
  CONSTRAINT purchase_requests_status_check CHECK ((status IN ('draft', 'pending', 'approved', 'rejected'))),
  CONSTRAINT purchase_requests_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE purchase_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  request_code VARCHAR(100) NOT NULL,
  vendor_code VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ordered',
  ordered_on DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY purchase_orders_code_key (code),
  KEY ix_purchase_orders_request_code (request_code),
  KEY ix_purchase_orders_vendor_code (vendor_code),
  CONSTRAINT purchase_orders_amount_check CHECK ((amount >= (0))),
  CONSTRAINT purchase_orders_status_check CHECK ((status IN ('ordered', 'received', 'paid'))),
  CONSTRAINT purchase_orders_request_code_fkey FOREIGN KEY (request_code) REFERENCES purchase_requests (code),
  CONSTRAINT purchase_orders_vendor_code_fkey FOREIGN KEY (vendor_code) REFERENCES vendors (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE asset_register (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  serial_number TEXT NOT NULL,
  assigned_employee_code VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY asset_register_code_key (code),
  KEY ix_asset_register_assigned_employee_code (assigned_employee_code),
  KEY ix_asset_register_item_code (item_code),
  CONSTRAINT asset_register_status_check CHECK ((status IN ('available', 'assigned', 'maintenance', 'retired'))),
  CONSTRAINT asset_register_assigned_employee_code_fkey FOREIGN KEY (assigned_employee_code) REFERENCES employees (code),
  CONSTRAINT asset_register_item_code_fkey FOREIGN KEY (item_code) REFERENCES inventory_items (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vehicle_trips (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  route_code VARCHAR(100) NOT NULL,
  trip_date DATE NOT NULL,
  driver_employee_code VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vehicle_trips_code_key (code),
  KEY ix_vehicle_trips_driver_employee_code (driver_employee_code),
  KEY ix_vehicle_trips_route_code (route_code),
  CONSTRAINT vehicle_trips_status_check CHECK ((status IN ('scheduled', 'departed', 'completed', 'cancelled'))),
  CONSTRAINT vehicle_trips_driver_employee_code_fkey FOREIGN KEY (driver_employee_code) REFERENCES employees (code),
  CONSTRAINT vehicle_trips_route_code_fkey FOREIGN KEY (route_code) REFERENCES transport_routes (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vehicle_maintenance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  vehicle_code VARCHAR(100) NOT NULL,
  service_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vehicle_maintenance_code_key (code),
  KEY ix_vehicle_maintenance_vehicle_code (vehicle_code),
  CONSTRAINT vehicle_maintenance_amount_check CHECK ((amount >= (0))),
  CONSTRAINT vehicle_maintenance_status_check CHECK ((status IN ('scheduled', 'completed'))),
  CONSTRAINT vehicle_maintenance_vehicle_code_fkey FOREIGN KEY (vehicle_code) REFERENCES vehicles (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vehicle_fuel (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  vehicle_code VARCHAR(100) NOT NULL,
  filled_on DATE NOT NULL,
  litres DECIMAL(12,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  odometer DECIMAL(12,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vehicle_fuel_code_key (code),
  KEY ix_vehicle_fuel_vehicle_code (vehicle_code),
  CONSTRAINT vehicle_fuel_amount_check CHECK ((amount >= (0))),
  CONSTRAINT vehicle_fuel_litres_check CHECK ((litres > (0))),
  CONSTRAINT vehicle_fuel_odometer_check CHECK ((odometer >= (0))),
  CONSTRAINT vehicle_fuel_vehicle_code_fkey FOREIGN KEY (vehicle_code) REFERENCES vehicles (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vehicle_seats (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  vehicle_code VARCHAR(100) NOT NULL,
  seat_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY vehicle_seats_code_key (code),
  UNIQUE KEY vehicle_seats_vehicle_code_seat_number_key (vehicle_code, seat_number),
  CONSTRAINT vehicle_seats_status_check CHECK ((status IN ('available', 'reserved', 'unavailable'))),
  CONSTRAINT vehicle_seats_vehicle_code_fkey FOREIGN KEY (vehicle_code) REFERENCES vehicles (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE passenger_seats (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  seat_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NULL,
  employee_code VARCHAR(100) NULL,
  route_code VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY passenger_seats_code_key (code),
  KEY ix_passenger_seats_employee_code (employee_code),
  KEY ix_passenger_seats_route_code (route_code),
  KEY ix_passenger_seats_seat_code (seat_code),
  KEY ix_passenger_seats_student_code (student_code),
  CONSTRAINT passenger_seats_check CHECK ((((student_code IS NOT NULL) + (employee_code IS NOT NULL)) = 1)),
  CONSTRAINT passenger_seats_check1 CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT passenger_seats_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code),
  CONSTRAINT passenger_seats_route_code_fkey FOREIGN KEY (route_code) REFERENCES transport_routes (code),
  CONSTRAINT passenger_seats_seat_code_fkey FOREIGN KEY (seat_code) REFERENCES vehicle_seats (code),
  CONSTRAINT passenger_seats_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE transport_attendance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  trip_code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NULL,
  employee_code VARCHAR(100) NULL,
  status TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY transport_attendance_code_key (code),
  KEY ix_transport_attendance_employee_code (employee_code),
  KEY ix_transport_attendance_student_code (student_code),
  KEY ix_transport_attendance_trip_code (trip_code),
  CONSTRAINT transport_attendance_check CHECK ((((student_code IS NOT NULL) + (employee_code IS NOT NULL)) = 1)),
  CONSTRAINT transport_attendance_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code),
  CONSTRAINT transport_attendance_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code),
  CONSTRAINT transport_attendance_trip_code_fkey FOREIGN KEY (trip_code) REFERENCES vehicle_trips (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE timetable_swap_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  slot_code VARCHAR(100) NOT NULL,
  target_slot_code VARCHAR(100) NOT NULL,
  requested_by_user_code VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY timetable_swap_requests_code_key (code),
  KEY ix_timetable_swap_requests_requested_by_user_code (requested_by_user_code),
  KEY ix_timetable_swap_requests_slot_code (slot_code),
  KEY ix_timetable_swap_requests_target_slot_code (target_slot_code),
  CONSTRAINT timetable_swap_requests_check CHECK (((slot_code) <> (target_slot_code))),
  CONSTRAINT timetable_swap_requests_status_check CHECK ((status IN ('pending', 'approved', 'rejected'))),
  CONSTRAINT timetable_swap_requests_requested_by_user_code_fkey FOREIGN KEY (requested_by_user_code) REFERENCES users (code),
  CONSTRAINT timetable_swap_requests_slot_code_fkey FOREIGN KEY (slot_code) REFERENCES timetable_slots (code),
  CONSTRAINT timetable_swap_requests_target_slot_code_fkey FOREIGN KEY (target_slot_code) REFERENCES timetable_slots (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payroll_adjustments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  component TEXT NOT NULL,
  component_type TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  payroll_run_code VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY payroll_adjustments_code_key (code),
  KEY ix_payroll_adjustments_employee_code (employee_code),
  KEY ix_payroll_adjustments_payroll_run_code (payroll_run_code),
  CONSTRAINT payroll_adjustments_amount_check CHECK ((amount >= (0))),
  CONSTRAINT payroll_adjustments_status_check CHECK ((status IN ('draft', 'pending', 'approved', 'rejected'))),
  CONSTRAINT payroll_adjustments_employee_code_fkey FOREIGN KEY (employee_code) REFERENCES employees (code),
  CONSTRAINT payroll_adjustments_payroll_run_code_fkey FOREIGN KEY (payroll_run_code) REFERENCES payroll_runs (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE college_invoices (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NULL,
  vendor_code VARCHAR(100) NULL,
  invoice_number VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY college_invoices_code_key (code),
  UNIQUE KEY college_invoices_invoice_number_key (invoice_number),
  KEY ix_college_invoices_student_code (student_code),
  KEY ix_college_invoices_vendor_code (vendor_code),
  CONSTRAINT college_invoices_amount_check CHECK ((amount >= (0))),
  CONSTRAINT college_invoices_status_check CHECK ((status IN ('draft', 'issued', 'paid', 'void'))),
  CONSTRAINT college_invoices_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code),
  CONSTRAINT college_invoices_vendor_code_fkey FOREIGN KEY (vendor_code) REFERENCES vendors (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notification_templates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY notification_templates_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notification_campaigns (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  template_code VARCHAR(100) NOT NULL,
  scheduled_at DATETIME(6) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY notification_campaigns_code_key (code),
  KEY ix_notification_campaigns_template_code (template_code),
  CONSTRAINT notification_campaigns_status_check CHECK ((status IN ('draft', 'queued', 'sent', 'failed'))),
  CONSTRAINT notification_campaigns_template_code_fkey FOREIGN KEY (template_code) REFERENCES notification_templates (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE expense_payment_entries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  expense_code VARCHAR(100) NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL,
  paid_on DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY expense_payment_entries_code_key (code),
  KEY ix_expense_payment_entries_expense_code (expense_code),
  CONSTRAINT expense_payment_entries_amount_check CHECK ((amount > (0))),
  CONSTRAINT expense_payment_entries_expense_code_fkey FOREIGN KEY (expense_code) REFERENCES expenses (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE record_extras (
  id BIGINT NOT NULL AUTO_INCREMENT,
  table_name VARCHAR(128) NOT NULL,
  record_code VARCHAR(100) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY record_extras_table_name_record_code_key (table_name, record_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Student enrollment wizard: the admission profile of each student (schema version V7).
CREATE TABLE student_admission_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  student_code VARCHAR(100) NOT NULL,
  program_code VARCHAR(100) NOT NULL,
  academic_year_code VARCHAR(100) NOT NULL,
  batch_code VARCHAR(100) NULL,
  section_code VARCHAR(100) NULL,
  course_level VARCHAR(50) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  last_qualification JSON NOT NULL DEFAULT (JSON_OBJECT()),
  referral JSON NULL,
  achievements JSON NOT NULL DEFAULT (JSON_ARRAY()),
  certifications JSON NOT NULL DEFAULT (JSON_ARRAY()),
  document_checklist JSON NOT NULL DEFAULT (JSON_OBJECT()),
  hostel_required BOOLEAN NOT NULL DEFAULT FALSE,
  transport_required BOOLEAN NOT NULL DEFAULT FALSE,
  scholarship_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  scholarship_name TEXT NULL,
  special_consideration_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  special_consideration_reason TEXT NULL,
  gross_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  fee_summary JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_by_user_code VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY student_admission_profiles_code_key (code),
  UNIQUE KEY student_admission_profiles_student_code_key (student_code),
  UNIQUE KEY student_admission_profiles_registration_number_key (registration_number),
  KEY ix_student_admission_profiles_academic_year_code (academic_year_code),
  KEY ix_student_admission_profiles_program_code (program_code),
  CONSTRAINT student_admission_profiles_course_level_check CHECK ((course_level IN ('intermediate', 'degree'))),
  CONSTRAINT student_admission_profiles_last_qualification_check CHECK ((JSON_TYPE(last_qualification) = 'OBJECT')),
  CONSTRAINT student_admission_profiles_referral_check CHECK (((referral IS NULL) OR (JSON_TYPE(referral) = 'OBJECT'))),
  CONSTRAINT student_admission_profiles_achievements_check CHECK ((JSON_TYPE(achievements) = 'ARRAY')),
  CONSTRAINT student_admission_profiles_certifications_check CHECK ((JSON_TYPE(certifications) = 'ARRAY')),
  CONSTRAINT student_admission_profiles_document_checklist_check CHECK ((JSON_TYPE(document_checklist) = 'OBJECT')),
  CONSTRAINT student_admission_profiles_fee_summary_check CHECK ((JSON_TYPE(fee_summary) = 'ARRAY')),
  CONSTRAINT student_admission_profiles_scholarship_amount_check CHECK ((scholarship_amount >= 0)),
  CONSTRAINT student_admission_profiles_special_consideration_amount_check CHECK ((special_consideration_amount >= 0)),
  CONSTRAINT student_admission_profiles_gross_fee_check CHECK ((gross_fee >= 0)),
  CONSTRAINT student_admission_profiles_net_fee_check CHECK ((net_fee >= 0)),
  CONSTRAINT student_admission_profiles_check CHECK (((special_consideration_amount = 0) OR (special_consideration_reason IS NOT NULL))),
  CONSTRAINT student_admission_profiles_student_code_fkey FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_admission_profiles_program_code_fkey FOREIGN KEY (program_code) REFERENCES programs (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_admission_profiles_academic_year_code_fkey FOREIGN KEY (academic_year_code) REFERENCES academic_years (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_admission_profiles_batch_code_fkey FOREIGN KEY (batch_code) REFERENCES batches (code) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT student_admission_profiles_section_code_fkey FOREIGN KEY (section_code) REFERENCES sections (code) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================================
-- Finance and certificate views
-- =============================================================================================

CREATE VIEW student_charge_balances AS
WITH adj AS (
  SELECT charge_code,
         SUM(CASE WHEN adjustment_type = 'fine' THEN amount ELSE -amount END) AS delta
  FROM fee_adjustments
  GROUP BY charge_code
), sch AS (
  SELECT a.charge_code, SUM(a.amount) AS amount
  FROM charge_scholarship_allocations a
  JOIN student_scholarships s ON s.code = a.student_scholarship_code
  WHERE s.status IN ('approved', 'disbursed')
  GROUP BY a.charge_code
), paid AS (
  SELECT a.charge_code, SUM(a.amount) AS amount
  FROM payment_allocations a
  JOIN payments p ON p.code = a.payment_code
  WHERE p.status IN ('settled', 'refunded')
  GROUP BY a.charge_code
), ref AS (
  SELECT charge_code, SUM(amount) AS amount
  FROM refund_allocations
  GROUP BY charge_code
)
SELECT c.code AS charge_code,
       c.student_code,
       f.currency,
       c.due_date,
       c.amount AS base_amount,
       COALESCE(adj.delta, 0) AS adjustment_amount,
       c.tax_amount,
       COALESCE(sch.amount, 0) AS scholarship_amount,
       c.amount + COALESCE(adj.delta, 0) + c.tax_amount - COALESCE(sch.amount, 0) AS net_payable,
       COALESCE(paid.amount, 0) - COALESCE(ref.amount, 0) AS paid_net,
       c.amount + COALESCE(adj.delta, 0) + c.tax_amount - COALESCE(sch.amount, 0)
         - COALESCE(paid.amount, 0) + COALESCE(ref.amount, 0) AS outstanding_amount
FROM student_fee_charges c
JOIN fee_structures f ON f.code = c.fee_structure_code
LEFT JOIN adj ON adj.charge_code = c.code
LEFT JOIN sch ON sch.charge_code = c.code
LEFT JOIN paid ON paid.charge_code = c.code
LEFT JOIN ref ON ref.charge_code = c.code;

CREATE VIEW admin_outstanding_by_student AS
SELECT student_code,
       currency,
       SUM(net_payable) AS net_payable,
       SUM(paid_net) AS paid_net,
       SUM(outstanding_amount) AS outstanding_amount,
       SUM(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN outstanding_amount ELSE 0 END) AS overdue_amount
FROM student_charge_balances
GROUP BY student_code, currency;

CREATE VIEW certificate_download_summary AS
SELECT certificate_code, COUNT(*) AS download_count, MAX(downloaded_at) AS last_downloaded_at
FROM certificate_download_events
GROUP BY certificate_code;

CREATE VIEW cashbook_movements AS
SELECT p.code AS reference, p.paid_on AS movement_date, s.campus_code, p.currency,
       'receipt' AS movement_type, p.amount AS receipt_amount, 0 AS payment_amount
FROM payments p
JOIN students s ON s.code = p.student_code
WHERE p.status IN ('settled', 'refunded')
UNION ALL
SELECT e.code, e.paid_on, e.campus_code, e.currency, 'expense', 0, e.amount
FROM expenses e
WHERE e.payment_status = 'paid'
UNION ALL
SELECT r.code, r.refunded_on, s.campus_code, p.currency, 'refund', 0, r.amount
FROM refunds r
JOIN payments p ON p.code = r.payment_code
JOIN students s ON s.code = p.student_code
UNION ALL
SELECT r.code, r.paid_on, r.campus_code, r.currency, 'external_remittance', 0, r.amount
FROM external_remittances r
WHERE r.status = 'paid' AND r.expense_code IS NULL;

CREATE VIEW daily_finance_summary AS
SELECT movement_date, campus_code, currency,
       SUM(receipt_amount) AS receipts,
       SUM(payment_amount) AS payments,
       SUM(receipt_amount - payment_amount) AS net_movement
FROM cashbook_movements
GROUP BY movement_date, campus_code, currency;

-- =============================================================================================
-- Validation triggers (translated from the PL/pgSQL trigger functions)
-- =============================================================================================

DELIMITER $$

-- Admissions: status changes follow the transition graph; offers must exist.
CREATE TRIGGER admission_state_order BEFORE UPDATE ON admission_applications FOR EACH ROW
BEGIN
  DECLARE msg VARCHAR(255);
  IF NOT (NEW.status <=> OLD.status) THEN
    IF NOT FIND_IN_SET(NEW.status, CASE OLD.status
        WHEN 'draft' THEN 'submitted,withdrawn'
        WHEN 'submitted' THEN 'documents_pending,reviewing,rejected,withdrawn'
        WHEN 'documents_pending' THEN 'reviewing,rejected,withdrawn'
        WHEN 'reviewing' THEN 'documents_pending,verified,rejected,withdrawn'
        WHEN 'verified' THEN 'offered,rejected,withdrawn'
        WHEN 'offered' THEN 'accepted,rejected,withdrawn'
        WHEN 'accepted' THEN 'enrolled,withdrawn'
        ELSE '' END) THEN
      SET msg = CONCAT('Invalid admission status transition: ', OLD.status, ' to ', NEW.status);
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
    END IF;
    IF NEW.status = 'offered' AND NOT EXISTS (
        SELECT 1 FROM admission_offers WHERE application_code = NEW.code AND status = 'issued') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An issued admission offer is required';
    END IF;
    IF NEW.status = 'accepted' AND NOT EXISTS (
        SELECT 1 FROM admission_offers
        WHERE application_code = NEW.code AND status = 'accepted' AND accept_by >= CURRENT_DATE) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A valid accepted admission offer is required';
    END IF;
  END IF;
END$$

-- Admissions: offers, acceptance and enrollment require complete, verified evidence.
CREATE TRIGGER admission_transition BEFORE UPDATE ON admission_applications FOR EACH ROW
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE req_type VARCHAR(100);
  DECLARE req_waiver BOOLEAN;
  DECLARE doc_status VARCHAR(255);
  DECLARE doc_expires DATE;
  DECLARE msg VARCHAR(255);
  DECLARE requirements CURSOR FOR
    SELECT document_type_code, waiver_allowed FROM program_document_requirements
    WHERE program_code = NEW.program_code AND academic_year_code = NEW.academic_year_code AND is_required
      AND admission_category IN ('all', NEW.admission_category)
      AND (required_stage IN ('submission', 'offer') OR NEW.status = 'enrolled');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  IF NOT (NEW.status <=> OLD.status) THEN
    IF NEW.status IN ('offered', 'accepted', 'enrolled') THEN
      IF NEW.date_of_birth IS NULL OR NEW.consent_at IS NULL OR NEW.source_code IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Admission identity, consent and source are required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM application_guardians WHERE application_code = NEW.code AND is_primary) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Primary application guardian is required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM application_qualifications
                     WHERE application_code = NEW.code AND result_status = 'passed') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A passed qualifying education record is required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM admission_reviews WHERE application_code = NEW.code AND decision = 'eligible') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An eligible admission review is required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM program_document_requirements
                     WHERE program_code = NEW.program_code AND academic_year_code = NEW.academic_year_code) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Program document checklist has not been configured';
      END IF;
      OPEN requirements;
      requirement_loop: LOOP
        FETCH requirements INTO req_type, req_waiver;
        IF done THEN
          LEAVE requirement_loop;
        END IF;
        SET doc_status = NULL, doc_expires = NULL;
        SELECT status, expires_on INTO doc_status, doc_expires FROM admission_documents
        WHERE application_code = NEW.code AND document_type_code = req_type AND is_current LIMIT 1;
        SET done = 0;  -- a missing document also raises NOT FOUND; keep looping over requirements
        IF doc_status IS NULL OR doc_status NOT IN ('verified', 'waived') THEN
          SET msg = CONCAT('Required admission document ', req_type, ' is not verified');
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
        END IF;
        IF doc_status = 'waived' AND NOT req_waiver THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document waiver is not allowed';
        END IF;
        IF doc_expires IS NOT NULL AND doc_expires < CURRENT_DATE THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required admission document is expired';
        END IF;
      END LOOP;
      CLOSE requirements;
    END IF;
    IF NEW.status = 'enrolled' THEN
      IF OLD.status <> 'accepted' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Enrollment requires an accepted application';
      END IF;
      IF NEW.student_code IS NULL OR NOT EXISTS (
          SELECT 1 FROM admission_enrollment_events
          WHERE application_code = NEW.code AND student_code = NEW.student_code) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authorized enrollment linkage is required';
      END IF;
    END IF;
  END IF;
END$$

-- Admission documents: type, size and verification requirements of the document type.
CREATE TRIGGER admission_document_validation_insert BEFORE INSERT ON admission_documents FOR EACH ROW
BEGIN
  DECLARE max_bytes BIGINT;
  DECLARE mimes JSON;
  DECLARE expiry_req BOOLEAN;
  DECLARE sighting_req BOOLEAN;
  SELECT maximum_file_bytes, accepted_mime_types, expiry_required, original_sighting_required
    INTO max_bytes, mimes, expiry_req, sighting_req
  FROM document_types WHERE code = NEW.document_type_code;
  IF NEW.status <> 'waived' AND (NEW.size_bytes > max_bytes OR NOT JSON_CONTAINS(mimes, JSON_QUOTE(NEW.mime_type))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document type or size is not permitted';
  END IF;
  IF NEW.status = 'verified' AND ((expiry_req AND NEW.expires_on IS NULL) OR (sighting_req AND NOT NEW.original_sighted)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document expiry or original sighting is required';
  END IF;
END$$

CREATE TRIGGER admission_document_validation_update BEFORE UPDATE ON admission_documents FOR EACH ROW
BEGIN
  DECLARE max_bytes BIGINT;
  DECLARE mimes JSON;
  DECLARE expiry_req BOOLEAN;
  DECLARE sighting_req BOOLEAN;
  SELECT maximum_file_bytes, accepted_mime_types, expiry_required, original_sighting_required
    INTO max_bytes, mimes, expiry_req, sighting_req
  FROM document_types WHERE code = NEW.document_type_code;
  IF NEW.status <> 'waived' AND (NEW.size_bytes > max_bytes OR NOT JSON_CONTAINS(mimes, JSON_QUOTE(NEW.mime_type))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document type or size is not permitted';
  END IF;
  IF NEW.status = 'verified' AND ((expiry_req AND NEW.expires_on IS NULL) OR (sighting_req AND NOT NEW.original_sighted)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document expiry or original sighting is required';
  END IF;
END$$

-- Verified or waived evidence is immutable; corrections are uploaded as a new revision.
CREATE TRIGGER protect_document_evidence BEFORE UPDATE ON admission_documents FOR EACH ROW
BEGIN
  IF OLD.status IN ('verified', 'waived') AND (
      NOT (NEW.storage_key <=> OLD.storage_key) OR NOT (NEW.sha256 <=> OLD.sha256)
      OR NOT (NEW.mime_type <=> OLD.mime_type) OR NOT (NEW.size_bytes <=> OLD.size_bytes)
      OR NEW.document_type_code <> OLD.document_type_code OR NEW.application_code <> OLD.application_code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Verified evidence cannot be replaced; upload a new document revision';
  END IF;
END$$

-- Enrollment events must match the accepted application's student, program and academic year.
CREATE TRIGGER enrollment_link_validation_insert BEFORE INSERT ON admission_enrollment_events FOR EACH ROW
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM admission_applications a
      JOIN student_enrollments e ON e.code = NEW.enrollment_code
      JOIN sections sec ON sec.code = e.section_code
      JOIN batches b ON b.code = sec.batch_code
      JOIN semesters sem ON sem.code = sec.semester_code
      WHERE a.code = NEW.application_code AND a.status = 'accepted' AND e.student_code = NEW.student_code
        AND b.program_code = a.program_code AND sem.academic_year_code = a.academic_year_code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Enrollment student, program and academic year must match the accepted application';
  END IF;
END$$

CREATE TRIGGER enrollment_link_validation_update BEFORE UPDATE ON admission_enrollment_events FOR EACH ROW
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM admission_applications a
      JOIN student_enrollments e ON e.code = NEW.enrollment_code
      JOIN sections sec ON sec.code = e.section_code
      JOIN batches b ON b.code = sec.batch_code
      JOIN semesters sem ON sem.code = sec.semester_code
      WHERE a.code = NEW.application_code AND a.status = 'accepted' AND e.student_code = NEW.student_code
        AND b.program_code = a.program_code AND sem.academic_year_code = a.academic_year_code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Enrollment student, program and academic year must match the accepted application';
  END IF;
END$$

-- Enrolled students' document links must point at their own enrolled application.
CREATE TRIGGER student_document_link_validation_insert BEFORE INSERT ON student_document_links FOR EACH ROW
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM admission_documents d JOIN admission_applications a ON a.code = d.application_code
      WHERE d.code = NEW.admission_document_code AND a.student_code = NEW.student_code AND a.status = 'enrolled') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document must belong to the enrolled student application';
  END IF;
END$$

CREATE TRIGGER student_document_link_validation_update BEFORE UPDATE ON student_document_links FOR EACH ROW
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM admission_documents d JOIN admission_applications a ON a.code = d.application_code
      WHERE d.code = NEW.admission_document_code AND a.student_code = NEW.student_code AND a.status = 'enrolled') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document must belong to the enrolled student application';
  END IF;
END$$

-- Append-only audit history.
CREATE TRIGGER preserve_admission_history_update BEFORE UPDATE ON admission_status_history FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_admission_history_delete BEFORE DELETE ON admission_status_history FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_verification_history_update BEFORE UPDATE ON document_verification_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_verification_history_delete BEFORE DELETE ON document_verification_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_certificate_download_history_update BEFORE UPDATE ON certificate_download_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_certificate_download_history_delete BEFORE DELETE ON certificate_download_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_student_status_history_update BEFORE UPDATE ON student_status_history FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$
CREATE TRIGGER preserve_student_status_history_delete BEFORE DELETE ON student_status_history FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'$$

-- Finance: a payment allocation matches the charge's student and currency and fits the payment.
CREATE TRIGGER validate_payment_split_insert BEFORE INSERT ON payment_allocations FOR EACH ROW
BEGIN
  DECLARE p_student VARCHAR(100);
  DECLARE p_currency VARCHAR(255);
  DECLARE p_amount DECIMAL(18,2);
  DECLARE charge_student VARCHAR(100);
  DECLARE charge_currency VARCHAR(255);
  DECLARE allocated DECIMAL(18,2);
  SELECT student_code, currency, amount INTO p_student, p_currency, p_amount
  FROM payments WHERE code = NEW.payment_code FOR UPDATE;
  SELECT c.student_code, f.currency INTO charge_student, charge_currency
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code WHERE c.code = NEW.charge_code;
  IF p_student <> charge_student OR p_currency <> charge_currency THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment and charge student/currency must match';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO allocated FROM payment_allocations
  WHERE payment_code = NEW.payment_code AND code <> NEW.code;
  IF NEW.amount <= 0 OR allocated + NEW.amount > p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation exceeds payment amount or is not positive';
  END IF;
END$$

CREATE TRIGGER validate_payment_split_update BEFORE UPDATE ON payment_allocations FOR EACH ROW
BEGIN
  DECLARE p_student VARCHAR(100);
  DECLARE p_currency VARCHAR(255);
  DECLARE p_amount DECIMAL(18,2);
  DECLARE charge_student VARCHAR(100);
  DECLARE charge_currency VARCHAR(255);
  DECLARE allocated DECIMAL(18,2);
  SELECT student_code, currency, amount INTO p_student, p_currency, p_amount
  FROM payments WHERE code = NEW.payment_code FOR UPDATE;
  SELECT c.student_code, f.currency INTO charge_student, charge_currency
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code WHERE c.code = NEW.charge_code;
  IF p_student <> charge_student OR p_currency <> charge_currency THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment and charge student/currency must match';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO allocated FROM payment_allocations
  WHERE payment_code = NEW.payment_code AND code <> NEW.code;
  IF NEW.amount <= 0 OR allocated + NEW.amount > p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation exceeds payment amount or is not positive';
  END IF;
END$$

-- Finance: payments cannot drop below what is allocated, nor move student/currency once allocated.
CREATE TRIGGER payment_reduction_guard BEFORE UPDATE ON payments FOR EACH ROW
BEGIN
  IF NEW.amount < (SELECT COALESCE(SUM(amount), 0) FROM payment_allocations WHERE payment_code = OLD.code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment cannot be reduced below allocated total';
  END IF;
  IF (NEW.student_code <> OLD.student_code OR NEW.currency <> OLD.currency)
     AND EXISTS (SELECT 1 FROM payment_allocations WHERE payment_code = OLD.code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocated payment student and currency cannot be changed';
  END IF;
END$$

-- Finance: scholarship allocations need an approved award of the same student on an eligible head.
CREATE TRIGGER scholarship_split_validation_insert BEFORE INSERT ON charge_scholarship_allocations FOR EACH ROW
BEGIN
  DECLARE a_code VARCHAR(100);
  DECLARE a_student VARCHAR(100);
  DECLARE a_status VARCHAR(255);
  DECLARE a_amount DECIMAL(18,2);
  DECLARE charge_student VARCHAR(100);
  DECLARE eligible BOOLEAN;
  DECLARE total DECIMAL(18,2);
  SELECT code, student_code, status, amount INTO a_code, a_student, a_status, a_amount
  FROM student_scholarships WHERE code = NEW.student_scholarship_code FOR UPDATE;
  SELECT c.student_code, h.scholarship_eligible INTO charge_student, eligible
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code
  JOIN fee_heads h ON h.code = f.fee_head_code WHERE c.code = NEW.charge_code;
  IF a_student <> charge_student OR a_status NOT IN ('approved', 'disbursed') OR NOT eligible THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scholarship must be approved, belong to student and apply to eligible head';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM charge_scholarship_allocations
  WHERE student_scholarship_code = a_code AND code <> NEW.code;
  IF total + NEW.amount > a_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scholarship allocation exceeds approved award';
  END IF;
END$$

CREATE TRIGGER scholarship_split_validation_update BEFORE UPDATE ON charge_scholarship_allocations FOR EACH ROW
BEGIN
  DECLARE a_code VARCHAR(100);
  DECLARE a_student VARCHAR(100);
  DECLARE a_status VARCHAR(255);
  DECLARE a_amount DECIMAL(18,2);
  DECLARE charge_student VARCHAR(100);
  DECLARE eligible BOOLEAN;
  DECLARE total DECIMAL(18,2);
  SELECT code, student_code, status, amount INTO a_code, a_student, a_status, a_amount
  FROM student_scholarships WHERE code = NEW.student_scholarship_code FOR UPDATE;
  SELECT c.student_code, h.scholarship_eligible INTO charge_student, eligible
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code
  JOIN fee_heads h ON h.code = f.fee_head_code WHERE c.code = NEW.charge_code;
  IF a_student <> charge_student OR a_status NOT IN ('approved', 'disbursed') OR NOT eligible THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scholarship must be approved, belong to student and apply to eligible head';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM charge_scholarship_allocations
  WHERE student_scholarship_code = a_code AND code <> NEW.code;
  IF total + NEW.amount > a_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scholarship allocation exceeds approved award';
  END IF;
END$$

-- Finance: awards with allocations keep their student, approved status and enough amount.
CREATE TRIGGER scholarship_change_guard BEFORE UPDATE ON student_scholarships FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM charge_scholarship_allocations WHERE student_scholarship_code = OLD.code)
     AND (NEW.student_code <> OLD.student_code OR NEW.status NOT IN ('approved', 'disbursed')
          OR NEW.amount < (SELECT SUM(amount) FROM charge_scholarship_allocations WHERE student_scholarship_code = OLD.code)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scholarship change conflicts with existing charge allocations';
  END IF;
END$$

-- Finance: refund allocations match students and stay within the refund and the original payment.
CREATE TRIGGER refund_split_validation_insert BEFORE INSERT ON refund_allocations FOR EACH ROW
BEGIN
  DECLARE r_payment VARCHAR(100);
  DECLARE r_amount DECIMAL(18,2);
  DECLARE payment_student VARCHAR(100);
  DECLARE charge_student VARCHAR(100);
  DECLARE total DECIMAL(18,2);
  DECLARE paid_amount DECIMAL(18,2);
  SELECT payment_code, amount INTO r_payment, r_amount FROM refunds WHERE code = NEW.refund_code FOR UPDATE;
  SELECT student_code INTO payment_student FROM payments WHERE code = r_payment;
  SELECT student_code INTO charge_student FROM student_fee_charges WHERE code = NEW.charge_code;
  IF payment_student <> charge_student THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund and charge students must match';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM refund_allocations WHERE refund_code = NEW.refund_code AND code <> NEW.code;
  IF total + NEW.amount > r_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund allocation exceeds refund amount';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount FROM payment_allocations
  WHERE payment_code = r_payment AND charge_code = NEW.charge_code;
  SELECT COALESCE(SUM(a.amount), 0) INTO total FROM refund_allocations a
  JOIN refunds original ON original.code = a.refund_code
  WHERE original.payment_code = r_payment AND a.charge_code = NEW.charge_code AND a.code <> NEW.code;
  IF total + NEW.amount > paid_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Charge refunds exceed original payment allocation';
  END IF;
END$$

CREATE TRIGGER refund_split_validation_update BEFORE UPDATE ON refund_allocations FOR EACH ROW
BEGIN
  DECLARE r_payment VARCHAR(100);
  DECLARE r_amount DECIMAL(18,2);
  DECLARE payment_student VARCHAR(100);
  DECLARE charge_student VARCHAR(100);
  DECLARE total DECIMAL(18,2);
  DECLARE paid_amount DECIMAL(18,2);
  SELECT payment_code, amount INTO r_payment, r_amount FROM refunds WHERE code = NEW.refund_code FOR UPDATE;
  SELECT student_code INTO payment_student FROM payments WHERE code = r_payment;
  SELECT student_code INTO charge_student FROM student_fee_charges WHERE code = NEW.charge_code;
  IF payment_student <> charge_student THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund and charge students must match';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM refund_allocations WHERE refund_code = NEW.refund_code AND code <> NEW.code;
  IF total + NEW.amount > r_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund allocation exceeds refund amount';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount FROM payment_allocations
  WHERE payment_code = r_payment AND charge_code = NEW.charge_code;
  SELECT COALESCE(SUM(a.amount), 0) INTO total FROM refund_allocations a
  JOIN refunds original ON original.code = a.refund_code
  WHERE original.payment_code = r_payment AND a.charge_code = NEW.charge_code AND a.code <> NEW.code;
  IF total + NEW.amount > paid_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Charge refunds exceed original payment allocation';
  END IF;
END$$

-- Finance: external remittances match the charge's external party and currency and fit the transfer.
CREATE TRIGGER remittance_split_validation_insert BEFORE INSERT ON remittance_allocations FOR EACH ROW
BEGIN
  DECLARE rem_party VARCHAR(100);
  DECLARE rem_currency VARCHAR(255);
  DECLARE rem_amount DECIMAL(18,2);
  DECLARE party VARCHAR(100);
  DECLARE denomination VARCHAR(255);
  DECLARE total DECIMAL(18,2);
  SELECT party_code, currency, amount INTO rem_party, rem_currency, rem_amount
  FROM external_remittances WHERE code = NEW.remittance_code FOR UPDATE;
  SELECT h.external_party_code, f.currency INTO party, denomination
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code
  JOIN fee_heads h ON h.code = f.fee_head_code WHERE c.code = NEW.charge_code;
  IF party IS NULL OR party <> rem_party OR denomination <> rem_currency THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'External party and currency must match the charge';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM remittance_allocations
  WHERE remittance_code = NEW.remittance_code AND code <> NEW.code;
  IF total + NEW.amount > rem_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Remittance allocations exceed transfer amount';
  END IF;
END$$

CREATE TRIGGER remittance_split_validation_update BEFORE UPDATE ON remittance_allocations FOR EACH ROW
BEGIN
  DECLARE rem_party VARCHAR(100);
  DECLARE rem_currency VARCHAR(255);
  DECLARE rem_amount DECIMAL(18,2);
  DECLARE party VARCHAR(100);
  DECLARE denomination VARCHAR(255);
  DECLARE total DECIMAL(18,2);
  SELECT party_code, currency, amount INTO rem_party, rem_currency, rem_amount
  FROM external_remittances WHERE code = NEW.remittance_code FOR UPDATE;
  SELECT h.external_party_code, f.currency INTO party, denomination
  FROM student_fee_charges c JOIN fee_structures f ON f.code = c.fee_structure_code
  JOIN fee_heads h ON h.code = f.fee_head_code WHERE c.code = NEW.charge_code;
  IF party IS NULL OR party <> rem_party OR denomination <> rem_currency THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'External party and currency must match the charge';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total FROM remittance_allocations
  WHERE remittance_code = NEW.remittance_code AND code <> NEW.code;
  IF total + NEW.amount > rem_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Remittance allocations exceed transfer amount';
  END IF;
END$$

-- Hostel: a bed, and a student, have no overlapping allocation periods (end date inclusive; open
-- ended when NULL). Locks the student and bed rows to serialize concurrent allocations.
CREATE TRIGGER hostel_period_validation_insert BEFORE INSERT ON hostel_allocations FOR EACH ROW
BEGIN
  DECLARE locked INT;
  SELECT COUNT(*) INTO locked FROM students WHERE code = NEW.student_code FOR UPDATE;
  SELECT COUNT(*) INTO locked FROM hostel_beds WHERE code = NEW.bed_code FOR UPDATE;
  IF EXISTS (
      SELECT 1 FROM hostel_allocations a
      WHERE a.code <> NEW.code AND (a.bed_code = NEW.bed_code OR a.student_code = NEW.student_code)
        AND a.start_date <= COALESCE(NEW.end_date, '9999-12-31')
        AND NEW.start_date <= COALESCE(a.end_date, '9999-12-31')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hostel bed or student allocation overlaps an existing period';
  END IF;
END$$

CREATE TRIGGER hostel_period_validation_update BEFORE UPDATE ON hostel_allocations FOR EACH ROW
BEGIN
  DECLARE locked INT;
  SELECT COUNT(*) INTO locked FROM students WHERE code = NEW.student_code FOR UPDATE;
  SELECT COUNT(*) INTO locked FROM hostel_beds WHERE code = NEW.bed_code FOR UPDATE;
  IF EXISTS (
      SELECT 1 FROM hostel_allocations a
      WHERE a.code <> NEW.code AND (a.bed_code = NEW.bed_code OR a.student_code = NEW.student_code)
        AND a.start_date <= COALESCE(NEW.end_date, '9999-12-31')
        AND NEW.start_date <= COALESCE(a.end_date, '9999-12-31')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hostel bed or student allocation overlaps an existing period';
  END IF;
END$$

DELIMITER ;

-- BEGIN EDUNEXA SEED DATA
-- Reference data of the college: institution, campus, departments (one per course family)
-- and the course catalog (Intermediate groups and degree courses). Generated by
-- backend/tools/export_seed_sql.py from the live database; existing codes are skipped.

-- institutions: 1
INSERT IGNORE INTO institutions (code, name, email, phone, address, city, state, postal_code, country, website, affiliation) VALUES
  ('INST-PRAGATHI', 'Pragathi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- campuses: 1
INSERT IGNORE INTO campuses (code, institution_code, name, address, city, state, postal_code) VALUES
  ('CAMP-MAIN-CAMPUS', 'INST-PRAGATHI', 'Main Campus', NULL, NULL, NULL, NULL);

-- departments: 10
INSERT IGNORE INTO departments (code, campus_code, name) VALUES
  ('DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'CAMP-MAIN-CAMPUS', 'Agriculture and Related Non-Medical Fields'),
  ('DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'CAMP-MAIN-CAMPUS', 'Arts, Humanities and Social Sciences'),
  ('DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'CAMP-MAIN-CAMPUS', 'Commerce, Finance and Management'),
  ('DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'CAMP-MAIN-CAMPUS', 'Design, Architecture and Creative Arts'),
  ('DEP-EDUCATION-AND-TEACHING', 'CAMP-MAIN-CAMPUS', 'Education and Teaching'),
  ('DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'CAMP-MAIN-CAMPUS', 'Hospitality, Tourism, Aviation and Logistics'),
  ('DEP-INTERMEDIATE-CLASS-11-AND-12', 'CAMP-MAIN-CAMPUS', 'Intermediate (Class 11 and 12)'),
  ('DEP-LAW-AND-LEGAL-STUDIES', 'CAMP-MAIN-CAMPUS', 'Law and Legal Studies'),
  ('DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'CAMP-MAIN-CAMPUS', 'Science and Computer Applications'),
  ('DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'CAMP-MAIN-CAMPUS', 'Vocational and Industry-Oriented Degrees');

-- programs: 130
INSERT IGNORE INTO programs (code, department_code, name, qualification, course_level, branch, category, duration_label, semesters_label, duration_semesters, intake_capacity, subjects, career_opportunities) VALUES
  ('INT-BPC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate BPC', 'Intermediate', 'intermediate', 'BPC', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'Biology (Botany and Zoology), Physics, Chemistry and languages', 'B.Sc Botany, Zoology, Biotechnology, Microbiology, Environmental Science, Agriculture, Horticulture, Food Science and other life-science programmes'),
  ('INT-CEC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate CEC', 'Intermediate', 'intermediate', 'CEC', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'Civics or Political Science, Economics, Commerce and languages', 'B.Com, BBA, BA, Law, Journalism, Public Administration and Civil Services preparation'),
  ('INT-HEC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate HEC', 'Intermediate', 'intermediate', 'HEC', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'History, Economics, Civics and languages', 'BA, Social Work, Journalism, Political Science, Law and Public Administration'),
  ('INT-MEC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate MEC', 'Intermediate', 'intermediate', 'MEC', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'Mathematics, Economics, Commerce and languages', 'B.Com, BBA, BCA where eligible, Economics, Finance, Business Analytics and Actuarial Science'),
  ('INT-MPC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate MPC', 'Intermediate', 'intermediate', 'MPC', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'Mathematics, Physics, Chemistry and languages', 'BCA, B.Sc Computer Science, B.Sc Mathematics, B.Sc Data Science, BBA, and eligible architecture or other professional programmes'),
  ('INT-VOC', 'DEP-INTERMEDIATE-CLASS-11-AND-12', 'Intermediate Vocational', 'Intermediate', 'intermediate', 'Vocational', 'Intermediate', '2 years', '4 (1-1, 1-2, 2-1, 2-2)', 4, NULL, 'Computer applications, office administration, accounting, web applications, business administration and selected technical skills', 'Relevant vocational degrees, BCA where eligible, B.Com, BBA and entry-level employment'),
  ('DEG-B-SC-AGRIBUSINESS-MANAGEMENT', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Agribusiness Management', 'B.Sc', 'degree', 'Agribusiness Management', 'Agriculture and Related Non-Medical Fields', '3–4 years', '6–8', 6, NULL, NULL, 'Agribusiness, procurement'),
  ('DEG-B-SC-AGRICULTURAL-ECONOMICS', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Agricultural Economics', 'B.Sc', 'degree', 'Agricultural Economics', 'Agriculture and Related Non-Medical Fields', '3–4 years', '6–8', 6, NULL, NULL, 'Agricultural market analysis'),
  ('DEG-B-SC-AGRICULTURE', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Agriculture', 'B.Sc', 'degree', 'Agriculture', 'Agriculture and Related Non-Medical Fields', '4 years', 'Usually 8', 8, NULL, NULL, 'Agriculture officer through relevant recruitment, agronomist'),
  ('DEG-B-SC-FORESTRY', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Forestry', 'B.Sc', 'degree', 'Forestry', 'Agriculture and Related Non-Medical Fields', 'Usually 4 years', 'Usually 8', 8, NULL, NULL, 'Forestry, conservation'),
  ('DEG-B-SC-HORTICULTURE', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Horticulture', 'B.Sc', 'degree', 'Horticulture', 'Agriculture and Related Non-Medical Fields', '4 years', 'Usually 8', 8, NULL, NULL, 'Horticulturist, nursery management'),
  ('DEG-B-SC-PLANT-BIOTECHNOLOGY', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Plant Biotechnology', 'B.Sc', 'degree', 'Plant Biotechnology', 'Agriculture and Related Non-Medical Fields', '3–4 years', '6–8', 6, NULL, NULL, 'Plant research, biotechnology'),
  ('DEG-B-SC-SERICULTURE', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'B.Sc Sericulture', 'B.Sc', 'degree', 'Sericulture', 'Agriculture and Related Non-Medical Fields', '3–4 years', '6–8', 6, NULL, NULL, 'Silk production, sericulture'),
  ('DEG-BACHELOR-OF-DAIRY-TECHNOLOGY', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'Bachelor of Dairy Technology', 'Bachelor of Dairy Technology', 'degree', NULL, 'Agriculture and Related Non-Medical Fields', 'Usually 4 years', 'Usually 8', 8, NULL, NULL, 'Dairy production, processing'),
  ('DEG-BACHELOR-OF-FISHERIES-SCIENCE-B-F-SC', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'Bachelor of Fisheries Science (B.F.Sc)', 'Bachelor of Fisheries Science (B.F.Sc)', 'degree', NULL, 'Agriculture and Related Non-Medical Fields', 'Usually 4 years', 'Usually 8', 8, NULL, NULL, 'Fisheries, aquaculture'),
  ('DEG-BACHELOR-OF-FOOD-TECHNOLOGY', 'DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'Bachelor of Food Technology', 'Bachelor of Food Technology', 'degree', NULL, 'Agriculture and Related Non-Medical Fields', '3–4 years, depending on programme', '6–8', 6, NULL, NULL, 'Food processing, quality control'),
  ('DEG-BA-CRIMINOLOGY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Criminology', 'BA', 'degree', 'Criminology', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Crime research, correctional services'),
  ('DEG-BA-DEFENCE-STUDIES', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Defence Studies', 'BA', 'degree', 'Defence Studies', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Defence research, policy analysis'),
  ('DEG-BA-DEVELOPMENT-STUDIES', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Development Studies', 'BA', 'degree', 'Development Studies', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Development projects, research'),
  ('DEG-BA-ECONOMICS', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Economics', 'BA', 'degree', 'Economics', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Banking, economic research'),
  ('DEG-BA-ENGLISH', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA English', 'BA', 'degree', 'English', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Content writing, editing, publishing'),
  ('DEG-BA-GENERAL', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA General', 'BA', 'degree', 'General', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Government exams, administration'),
  ('DEG-BA-GEOGRAPHY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Geography', 'BA', 'degree', 'Geography', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'GIS, planning, environmental research'),
  ('DEG-BA-HISTORY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA History', 'BA', 'degree', 'History', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Research, museums, civil services'),
  ('DEG-BA-INTERNATIONAL-RELATIONS', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA International Relations', 'BA', 'degree', 'International Relations', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Policy research, international affairs'),
  ('DEG-BA-JOURNALISM-AND-MASS-COMMUNICATION', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Journalism and Mass Communication', 'BA', 'degree', 'Journalism and Mass Communication', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Journalism, media, PR'),
  ('DEG-BA-LANGUAGES', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Languages', 'BA', 'degree', 'Languages', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Translation, teaching, publishing'),
  ('DEG-BA-PHILOSOPHY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Philosophy', 'BA', 'degree', 'Philosophy', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Research, writing, education'),
  ('DEG-BA-POLITICAL-SCIENCE', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Political Science', 'BA', 'degree', 'Political Science', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Public policy, civil services'),
  ('DEG-BA-PSYCHOLOGY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Psychology', 'BA', 'degree', 'Psychology', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'HR, research, further psychology study'),
  ('DEG-BA-PUBLIC-ADMINISTRATION', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Public Administration', 'BA', 'degree', 'Public Administration', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Administration, policy support'),
  ('DEG-BA-SOCIOLOGY', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'BA Sociology', 'BA', 'degree', 'Sociology', 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Social research, NGOs'),
  ('DEG-BACHELOR-OF-FINE-ARTS-BFA', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'Bachelor of Fine Arts (BFA)', 'Bachelor of Fine Arts (BFA)', 'degree', NULL, 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Artist, illustrator'),
  ('DEG-BACHELOR-OF-SOCIAL-WORK-BSW', 'DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'Bachelor of Social Work (BSW)', 'Bachelor of Social Work (BSW)', 'degree', NULL, 'Arts, Humanities and Social Sciences', '3–4 years', '6–8', 6, NULL, NULL, 'Social work, NGO management'),
  ('DEG-B-COM-ACCOUNTING-AND-FINANCE', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com Accounting and Finance', 'B.Com', 'degree', 'Accounting and Finance', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Audit, finance, accounting'),
  ('DEG-B-COM-BANKING-AND-INSURANCE', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com Banking and Insurance', 'B.Com', 'degree', 'Banking and Insurance', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Banking, insurance operations'),
  ('DEG-B-COM-COMPUTER-APPLICATIONS', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com Computer Applications', 'B.Com', 'degree', 'Computer Applications', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'ERP support, accounting systems'),
  ('DEG-B-COM-GENERAL', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com General', 'B.Com', 'degree', 'General', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Accountant, accounts executive'),
  ('DEG-B-COM-HONOURS', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com Honours', 'B.Com', 'degree', 'Honours', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Financial analyst, accounting'),
  ('DEG-B-COM-TAXATION', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'B.Com Taxation', 'B.Com', 'degree', 'Taxation', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Tax assistant, compliance'),
  ('DEG-BACHELOR-OF-ACTUARIAL-SCIENCE', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'Bachelor of Actuarial Science', 'Bachelor of Actuarial Science', 'degree', NULL, 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Actuarial analyst after relevant exams'),
  ('DEG-BACHELOR-OF-INSURANCE-AND-RISK-MANAGEMENT', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'Bachelor of Insurance and Risk Management', 'Bachelor of Insurance and Risk Management', 'degree', NULL, 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Insurance, risk analysis'),
  ('DEG-BACHELOR-OF-MANAGEMENT-STUDIES-BMS', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'Bachelor of Management Studies (BMS)', 'Bachelor of Management Studies (BMS)', 'degree', NULL, 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Operations, management'),
  ('DEG-BACHELOR-OF-REAL-ESTATE-MANAGEMENT', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'Bachelor of Real Estate Management', 'Bachelor of Real Estate Management', 'degree', NULL, 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Property management, valuation'),
  ('DEG-BBA', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA', 'BBA', 'degree', 'General', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Management, business development'),
  ('DEG-BBA-BUSINESS-ANALYTICS', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA Business Analytics', 'BBA', 'degree', 'Business Analytics', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Business analyst, reporting analyst'),
  ('DEG-BBA-FINANCE', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA Finance', 'BBA', 'degree', 'Finance', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Finance, banking'),
  ('DEG-BBA-HUMAN-RESOURCES', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA Human Resources', 'BBA', 'degree', 'Human Resources', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'HR, recruitment'),
  ('DEG-BBA-INTERNATIONAL-BUSINESS', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA International Business', 'BBA', 'degree', 'International Business', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'International trade, exports'),
  ('DEG-BBA-MARKETING', 'DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'BBA Marketing', 'BBA', 'degree', 'Marketing', 'Commerce, Finance and Management', '3–4 years', '6–8', 6, NULL, NULL, 'Marketing, sales'),
  ('DEG-B-ARCH', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Arch', 'B.Arch', 'degree', NULL, 'Design, Architecture and Creative Arts', '5 years', 'Usually 10', 10, NULL, NULL, 'Architect after required registration'),
  ('DEG-B-DES', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des', 'B.Des', 'degree', 'General', 'Design, Architecture and Creative Arts', '4 years', '8', 8, NULL, NULL, 'Product, communication and digital design'),
  ('DEG-B-DES-ANIMATION-AND-VFX', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des Animation and VFX', 'B.Des', 'degree', 'Animation and VFX', 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Animator, VFX artist'),
  ('DEG-B-DES-FASHION-DESIGN', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des Fashion Design', 'B.Des', 'degree', 'Fashion Design', 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'Fashion designer'),
  ('DEG-B-DES-INTERIOR-DESIGN', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des Interior Design', 'B.Des', 'degree', 'Interior Design', 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'Interior designer'),
  ('DEG-B-DES-PRODUCT-DESIGN', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des Product Design', 'B.Des', 'degree', 'Product Design', 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'Product designer'),
  ('DEG-B-DES-UI-UX', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'B.Des UI/UX', 'B.Des', 'degree', 'UI/UX', 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'UI/UX designer'),
  ('DEG-BACHELOR-OF-ANIMATION', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Animation', 'Bachelor of Animation', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Animator, motion designer'),
  ('DEG-BACHELOR-OF-FASHION-TECHNOLOGY', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Fashion Technology', 'Bachelor of Fashion Technology', 'degree', NULL, 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'Apparel production, fashion technology'),
  ('DEG-BACHELOR-OF-FILM-AND-TELEVISION-PRODUCTION', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Film and Television Production', 'Bachelor of Film and Television Production', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Film production, editing'),
  ('DEG-BACHELOR-OF-PERFORMING-ARTS', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Performing Arts', 'Bachelor of Performing Arts', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Music, dance, theatre'),
  ('DEG-BACHELOR-OF-PHOTOGRAPHY', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Photography', 'Bachelor of Photography', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Photographer, content creator'),
  ('DEG-BACHELOR-OF-PLANNING-B-PLAN', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Planning (B.Plan)', 'Bachelor of Planning (B.Plan)', 'degree', NULL, 'Design, Architecture and Creative Arts', 'Usually 4 years', '8', 8, NULL, NULL, 'Urban planning, transport planning'),
  ('DEG-BACHELOR-OF-TEXTILE-DESIGN', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Textile Design', 'Bachelor of Textile Design', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Textile and print design'),
  ('DEG-BACHELOR-OF-VISUAL-ARTS', 'DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'Bachelor of Visual Arts', 'Bachelor of Visual Arts', 'degree', NULL, 'Design, Architecture and Creative Arts', '3–4 years', '6–8', 6, NULL, NULL, 'Visual artist, creative professional'),
  ('DEG-B-ED', 'DEP-EDUCATION-AND-TEACHING', 'B.Ed', 'B.Ed', 'degree', NULL, 'Education and Teaching', 'Programme-dependent', 'Varies', 6, NULL, NULL, 'Teaching after required qualifications'),
  ('DEG-BACHELOR-OF-ELEMENTARY-EDUCATION-B-EL-ED', 'DEP-EDUCATION-AND-TEACHING', 'Bachelor of Elementary Education (B.El.Ed)', 'Bachelor of Elementary Education (B.El.Ed)', 'degree', NULL, 'Education and Teaching', '4 years', '8', 8, NULL, NULL, 'Elementary teaching, subject to eligibility'),
  ('DEG-BACHELOR-OF-LIBRARY-AND-INFORMATION-SCIENCE-BLIS', 'DEP-EDUCATION-AND-TEACHING', 'Bachelor of Library and Information Science (BLIS)', 'Bachelor of Library and Information Science (BLIS)', 'degree', NULL, 'Education and Teaching', 'Commonly 1 year after graduation', 'Varies', 2, NULL, NULL, 'Library and information services'),
  ('DEG-BACHELOR-OF-PHYSICAL-EDUCATION-B-P-ED', 'DEP-EDUCATION-AND-TEACHING', 'Bachelor of Physical Education (B.P.Ed)', 'Bachelor of Physical Education (B.P.Ed)', 'degree', NULL, 'Education and Teaching', 'Commonly 2 years after graduation', '4', 4, NULL, NULL, 'Physical education, coaching'),
  ('DEG-BACHELOR-OF-SPORTS-MANAGEMENT', 'DEP-EDUCATION-AND-TEACHING', 'Bachelor of Sports Management', 'Bachelor of Sports Management', 'degree', NULL, 'Education and Teaching', '3–4 years', '6–8', 6, NULL, NULL, 'Sports administration'),
  ('DEG-BACHELOR-OF-SPORTS-SCIENCE', 'DEP-EDUCATION-AND-TEACHING', 'Bachelor of Sports Science', 'Bachelor of Sports Science', 'degree', NULL, 'Education and Teaching', '3–4 years', '6–8', 6, NULL, NULL, 'Sports performance, fitness'),
  ('DEG-INTEGRATED-B-SC-B-ED', 'DEP-EDUCATION-AND-TEACHING', 'Integrated B.Sc B.Ed', 'Integrated B.Sc B.Ed', 'degree', NULL, 'Education and Teaching', 'Usually 4 years in approved pathways', '8', 8, NULL, NULL, 'Science teaching'),
  ('DEG-INTEGRATED-BA-B-ED', 'DEP-EDUCATION-AND-TEACHING', 'Integrated BA B.Ed', 'Integrated BA B.Ed', 'degree', NULL, 'Education and Teaching', 'Usually 4 years in approved pathways', '8', 8, NULL, NULL, 'School teaching'),
  ('DEG-B-SC-AVIATION', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'B.Sc Aviation', 'B.Sc', 'degree', 'Aviation', 'Hospitality, Tourism, Aviation and Logistics', 'Usually 3 years', '6', 6, NULL, NULL, 'Aviation operations'),
  ('DEG-B-SC-HOSPITALITY-AND-HOTEL-ADMINISTRATION', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'B.Sc Hospitality and Hotel Administration', 'B.Sc', 'degree', 'Hospitality and Hotel Administration', 'Hospitality, Tourism, Aviation and Logistics', 'Usually 3 years', '6', 6, NULL, NULL, 'Hotel management, front office'),
  ('DEG-BACHELOR-OF-AVIATION-MANAGEMENT', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Aviation Management', 'Bachelor of Aviation Management', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Airport operations'),
  ('DEG-BACHELOR-OF-CULINARY-ARTS', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Culinary Arts', 'Bachelor of Culinary Arts', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Chef, kitchen management'),
  ('DEG-BACHELOR-OF-EVENT-MANAGEMENT', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Event Management', 'Bachelor of Event Management', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Event coordination'),
  ('DEG-BACHELOR-OF-HOTEL-MANAGEMENT-BHM', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Hotel Management (BHM)', 'Bachelor of Hotel Management (BHM)', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Hotel operations, hospitality'),
  ('DEG-BACHELOR-OF-MARITIME-STUDIES', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Maritime Studies', 'Bachelor of Maritime Studies', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', 'Programme-dependent', 'Varies', 6, NULL, NULL, 'Maritime operations'),
  ('DEG-BACHELOR-OF-SHIPPING-AND-PORT-MANAGEMENT', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Shipping and Port Management', 'Bachelor of Shipping and Port Management', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Shipping and port operations'),
  ('DEG-BACHELOR-OF-TOURISM-ADMINISTRATION', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'Bachelor of Tourism Administration', 'Bachelor of Tourism Administration', 'degree', NULL, 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Tourism operations'),
  ('DEG-BBA-LOGISTICS-AND-SUPPLY-CHAIN-MANAGEMENT', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'BBA Logistics and Supply Chain Management', 'BBA', 'degree', 'Logistics and Supply Chain Management', 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Logistics, procurement'),
  ('DEG-BBA-TOURISM-AND-TRAVEL-MANAGEMENT', 'DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'BBA Tourism and Travel Management', 'BBA', 'degree', 'Tourism and Travel Management', 'Hospitality, Tourism, Aviation and Logistics', '3–4 years', '6–8', 6, NULL, NULL, 'Travel management'),
  ('DEG-B-COM-LLB', 'DEP-LAW-AND-LEGAL-STUDIES', 'B.Com LLB', 'B.Com LLB', 'degree', NULL, 'Law and Legal Studies', '5 years', 'Usually 10', 10, NULL, NULL, 'Commercial law, taxation-related legal work. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-B-SC-LLB', 'DEP-LAW-AND-LEGAL-STUDIES', 'B.Sc LLB', 'B.Sc LLB', 'degree', NULL, 'Law and Legal Studies', '5 years', 'Usually 10', 10, NULL, NULL, 'Legal research, litigation. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-BA-LLB', 'DEP-LAW-AND-LEGAL-STUDIES', 'BA LLB', 'BA LLB', 'degree', NULL, 'Law and Legal Studies', '5 years', 'Usually 10', 10, NULL, NULL, 'Legal practice, legal research. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-BBA-LLB', 'DEP-LAW-AND-LEGAL-STUDIES', 'BBA LLB', 'BBA LLB', 'degree', NULL, 'Law and Legal Studies', '5 years', 'Usually 10', 10, NULL, NULL, 'Corporate law, compliance. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-BLS-LLB', 'DEP-LAW-AND-LEGAL-STUDIES', 'BLS LLB', 'BLS LLB', 'degree', NULL, 'Law and Legal Studies', '5 years', 'Usually 10', 10, NULL, NULL, 'Legal practice, legal services. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-LLB-AFTER-GRADUATION', 'DEP-LAW-AND-LEGAL-STUDIES', 'LLB after graduation', 'LLB after graduation', 'degree', NULL, 'Law and Legal Studies', '3 years', '6', 6, NULL, NULL, 'Advocacy, legal associate. Legal practice requires meeting the applicable professional enrolment requirements.'),
  ('DEG-B-SC-ARTIFICIAL-INTELLIGENCE', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Artificial Intelligence', 'B.Sc', 'degree', 'Artificial Intelligence', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'AI development, machine learning'),
  ('DEG-B-SC-BIOTECHNOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Biotechnology', 'B.Sc', 'degree', 'Biotechnology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Biotechnology research and industry'),
  ('DEG-B-SC-BOTANY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Botany', 'B.Sc', 'degree', 'Botany', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Plant research, conservation'),
  ('DEG-B-SC-CHEMISTRY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Chemistry', 'B.Sc', 'degree', 'Chemistry', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Chemical testing, quality control'),
  ('DEG-B-SC-CLOUD-COMPUTING', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Cloud Computing', 'B.Sc', 'degree', 'Cloud Computing', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Cloud support, cloud engineering'),
  ('DEG-B-SC-COMPUTER-SCIENCE', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Computer Science', 'B.Sc', 'degree', 'Computer Science', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Software development'),
  ('DEG-B-SC-CYBERSECURITY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Cybersecurity', 'B.Sc', 'degree', 'Cybersecurity', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Security analyst'),
  ('DEG-B-SC-DATA-SCIENCE', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Data Science', 'B.Sc', 'degree', 'Data Science', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Data analyst, junior data scientist'),
  ('DEG-B-SC-ELECTRONICS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Electronics', 'B.Sc', 'degree', 'Electronics', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Electronics testing, technical support'),
  ('DEG-B-SC-ENVIRONMENTAL-SCIENCE', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Environmental Science', 'B.Sc', 'degree', 'Environmental Science', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Environmental analysis'),
  ('DEG-B-SC-FOOD-SCIENCE-AND-TECHNOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Food Science and Technology', 'B.Sc', 'degree', 'Food Science and Technology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Food production, quality assurance'),
  ('DEG-B-SC-GEOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Geology', 'B.Sc', 'degree', 'Geology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Geological research, mining sector'),
  ('DEG-B-SC-INFORMATION-TECHNOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Information Technology', 'B.Sc', 'degree', 'Information Technology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'IT, systems administration'),
  ('DEG-B-SC-MATHEMATICS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Mathematics', 'B.Sc', 'degree', 'Mathematics', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Data analysis, quantitative research'),
  ('DEG-B-SC-MATHEMATICS-AND-COMPUTING', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Mathematics and Computing', 'B.Sc', 'degree', 'Mathematics and Computing', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Computing, analytics'),
  ('DEG-B-SC-MICROBIOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Microbiology', 'B.Sc', 'degree', 'Microbiology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Industrial microbiology, laboratory research'),
  ('DEG-B-SC-PHYSICS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Physics', 'B.Sc', 'degree', 'Physics', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Research, laboratory work'),
  ('DEG-B-SC-SOFTWARE-DEVELOPMENT', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Software Development', 'B.Sc', 'degree', 'Software Development', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Software development, testing'),
  ('DEG-B-SC-STATISTICS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Statistics', 'B.Sc', 'degree', 'Statistics', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Statistics, data analytics'),
  ('DEG-B-SC-ZOOLOGY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'B.Sc Zoology', 'B.Sc', 'degree', 'Zoology', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Wildlife research, conservation'),
  ('DEG-BACHELOR-OF-INFORMATION-SYSTEMS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'Bachelor of Information Systems', 'Bachelor of Information Systems', 'degree', NULL, 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Business systems analyst, ERP consultant'),
  ('DEG-BCA', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA', 'BCA', 'degree', 'General', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Software developer, web developer'),
  ('DEG-BCA-ARTIFICIAL-INTELLIGENCE-AND-ML', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA Artificial Intelligence and ML', 'BCA', 'degree', 'Artificial Intelligence and ML', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'AI/ML associate'),
  ('DEG-BCA-CLOUD-COMPUTING', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA Cloud Computing', 'BCA', 'degree', 'Cloud Computing', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Cloud support, infrastructure'),
  ('DEG-BCA-CYBERSECURITY', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA Cybersecurity', 'BCA', 'degree', 'Cybersecurity', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Cybersecurity operations'),
  ('DEG-BCA-DATA-ANALYTICS', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA Data Analytics', 'BCA', 'degree', 'Data Analytics', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Data analyst, BI developer'),
  ('DEG-BCA-GAME-DEVELOPMENT', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA Game Development', 'BCA', 'degree', 'Game Development', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'Game developer'),
  ('DEG-BCA-UI-UX-AND-MULTIMEDIA', 'DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'BCA UI/UX and Multimedia', 'BCA', 'degree', 'UI/UX and Multimedia', 'Science and Computer Applications', '3–4 years', '6–8', 6, NULL, NULL, 'UI designer, UX associate'),
  ('DEG-B-VOC-ANIMATION-AND-MULTIMEDIA', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Animation and Multimedia', 'B.Voc', 'degree', 'Animation and Multimedia', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Animation and digital media'),
  ('DEG-B-VOC-AUTOMOBILE-SERVICING', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Automobile Servicing', 'B.Voc', 'degree', 'Automobile Servicing', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Automotive service'),
  ('DEG-B-VOC-BANKING-AND-FINANCE', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Banking and Finance', 'B.Voc', 'degree', 'Banking and Finance', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Banking operations'),
  ('DEG-B-VOC-FOOD-PROCESSING', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Food Processing', 'B.Voc', 'degree', 'Food Processing', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Food production'),
  ('DEG-B-VOC-LOGISTICS', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Logistics', 'B.Voc', 'degree', 'Logistics', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Warehouse and supply chain'),
  ('DEG-B-VOC-RENEWABLE-ENERGY', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Renewable Energy', 'B.Voc', 'degree', 'Renewable Energy', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Solar and renewable energy'),
  ('DEG-B-VOC-RETAIL-MANAGEMENT', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Retail Management', 'B.Voc', 'degree', 'Retail Management', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Retail operations'),
  ('DEG-B-VOC-SOFTWARE-DEVELOPMENT', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Software Development', 'B.Voc', 'degree', 'Software Development', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Junior developer'),
  ('DEG-B-VOC-TOURISM-AND-HOSPITALITY', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'B.Voc Tourism and Hospitality', 'B.Voc', 'degree', 'Tourism and Hospitality', 'Vocational and Industry-Oriented Degrees', 'Usually 3 years', '6', 6, NULL, NULL, 'Tourism and hospitality'),
  ('DEG-BACHELOR-OF-CONSTRUCTION-MANAGEMENT', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'Bachelor of Construction Management', 'Bachelor of Construction Management', 'degree', NULL, 'Vocational and Industry-Oriented Degrees', '3–4 years', '6–8', 6, NULL, NULL, 'Construction project coordination'),
  ('DEG-BACHELOR-OF-DISASTER-MANAGEMENT', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'Bachelor of Disaster Management', 'Bachelor of Disaster Management', 'degree', NULL, 'Vocational and Industry-Oriented Degrees', '3–4 years', '6–8', 6, NULL, NULL, 'Emergency planning, disaster response'),
  ('DEG-BACHELOR-OF-PACKAGING-TECHNOLOGY', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'Bachelor of Packaging Technology', 'Bachelor of Packaging Technology', 'degree', NULL, 'Vocational and Industry-Oriented Degrees', '3–4 years', '6–8', 6, NULL, NULL, 'Packaging design and quality');
-- END EDUNEXA SEED DATA
