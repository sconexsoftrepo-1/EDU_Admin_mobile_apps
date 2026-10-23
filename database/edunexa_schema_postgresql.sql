-- =============================================================================================
-- EduNexa College database schema — PostgreSQL 16+ (Supabase)
--
-- The complete schema: all 146 tables with keys, foreign keys, CHECK rules, indexes, triggers,
-- finance views and row level security. The backend installs it with
-- backend/tools/apply_schema.py (fresh database only); edunexa_schema_mysql.sql is the MySQL 8
-- edition of the same schema. Sections marked "BEGIN EDUNEXA Vn" are the schema versions it
-- includes (V2-V8). It ends with the college's reference data: the institution, campus,
-- departments and the course catalog (refresh with backend/tools/export_seed_sql.py).
--
--     psql -v ON_ERROR_STOP=1 -d <database> -f edunexa_schema_postgresql.sql
-- =============================================================================================

-- Stable external codes also serve as Excel relationship keys. Single institution per database.

BEGIN;

CREATE TABLE institutions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email VARCHAR(254),
  phone VARCHAR(40),
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code VARCHAR(100),
  country TEXT,
  website TEXT,
  affiliation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campuses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  institution_code VARCHAR(100) NOT NULL REFERENCES institutions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_campuses_institution_code ON campuses (institution_code);

CREATE TABLE academic_years (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE TABLE departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_departments_campus_code ON departments (campus_code);

CREATE TABLE programs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  department_code VARCHAR(100) NOT NULL REFERENCES departments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  qualification TEXT NOT NULL,
  duration_semesters INTEGER NOT NULL CHECK (duration_semesters > 0),
  intake_capacity INTEGER CHECK (intake_capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_programs_department_code ON programs (department_code);

CREATE TABLE batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  program_code VARCHAR(100) NOT NULL REFERENCES programs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  entry_year INTEGER NOT NULL CHECK (entry_year > 0),
  graduation_year INTEGER CHECK (graduation_year > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_batches_program_code ON batches (program_code);

CREATE TABLE semesters (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  semester_number INTEGER NOT NULL CHECK (semester_number > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE INDEX ix_semesters_academic_year_code ON semesters (academic_year_code);

CREATE TABLE sections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  batch_code VARCHAR(100) NOT NULL REFERENCES batches(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  semester_code VARCHAR(100) NULL REFERENCES semesters(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  capacity INTEGER CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_sections_batch_code ON sections (batch_code);

CREATE INDEX ix_sections_semester_code ON sections (semester_code);

CREATE TABLE subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  department_code VARCHAR(100) NOT NULL REFERENCES departments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  credits NUMERIC(12,2) NOT NULL CHECK (credits >= 0),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('theory','practical','project','elective')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_subjects_department_code ON subjects (department_code);

CREATE TABLE curriculum_subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  program_code VARCHAR(100) NOT NULL REFERENCES programs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  subject_code VARCHAR(100) NOT NULL REFERENCES subjects(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  semester_number INTEGER NOT NULL CHECK (semester_number > 0),
  is_required BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(program_code,subject_code,semester_number)
);

CREATE INDEX ix_curriculum_subjects_program_code ON curriculum_subjects (program_code);

CREATE INDEX ix_curriculum_subjects_subject_code ON curriculum_subjects (subject_code);

CREATE TABLE rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('classroom','laboratory','hall','office')),
  capacity INTEGER CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_rooms_campus_code ON rooms (campus_code);

CREATE TABLE employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  department_code VARCHAR(100) NOT NULL REFERENCES departments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  employee_type TEXT NOT NULL CHECK (employee_type IN ('teacher','staff')),
  designation TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('female','male','other','prefer_not_to_say')),
  join_date DATE NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('permanent','contract','part_time')),
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code VARCHAR(100),
  emergency_contact_name TEXT,
  emergency_contact_phone VARCHAR(40),
  status TEXT NOT NULL CHECK (status IN ('active','on_leave','left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_employees_campus_code ON employees (campus_code);

CREATE INDEX ix_employees_department_code ON employees (department_code);

CREATE TABLE teachers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  qualification TEXT NOT NULL,
  specialization TEXT,
  experience_years NUMERIC(12,2) CHECK (experience_years >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_code)
);

CREATE INDEX ix_teachers_employee_code ON teachers (employee_code);

CREATE TABLE staff_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  responsibility TEXT NOT NULL,
  shift TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_code)
);

CREATE INDEX ix_staff_profiles_employee_code ON staff_profiles (employee_code);

CREATE TABLE students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  admission_number VARCHAR(100) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female','male','other','prefer_not_to_say')),
  email VARCHAR(254),
  phone VARCHAR(40),
  admission_date DATE NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code VARCHAR(100) NOT NULL,
  country TEXT NOT NULL,
  blood_group TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  nationality TEXT,
  previous_institution TEXT,
  previous_qualification TEXT,
  previous_score NUMERIC(12,2) CHECK (previous_score >= 0),
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone VARCHAR(40) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','graduated','withdrawn','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admission_number)
);

CREATE INDEX ix_students_campus_code ON students (campus_code);

CREATE TABLE parents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email VARCHAR(254),
  phone VARCHAR(40) NOT NULL,
  alternate_phone VARCHAR(40),
  occupation TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_parents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  parent_code VARCHAR(100) NOT NULL REFERENCES parents(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  relationship TEXT NOT NULL CHECK (relationship IN ('father','mother','guardian','other')),
  is_primary BOOLEAN NOT NULL,
  can_pickup BOOLEAN NOT NULL,
  receives_notifications BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_code,parent_code)
);

CREATE INDEX ix_student_parents_student_code ON student_parents (student_code);

CREATE INDEX ix_student_parents_parent_code ON student_parents (parent_code);

CREATE TABLE student_enrollments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  section_code VARCHAR(100) NOT NULL REFERENCES sections(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  roll_number VARCHAR(100) NOT NULL,
  enrolled_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','completed','transferred','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_code,section_code),
  UNIQUE(section_code,roll_number)
);

CREATE INDEX ix_student_enrollments_student_code ON student_enrollments (student_code);

CREATE INDEX ix_student_enrollments_section_code ON student_enrollments (section_code);

CREATE TABLE subject_offerings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  subject_code VARCHAR(100) NOT NULL REFERENCES subjects(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  section_code VARCHAR(100) NOT NULL REFERENCES sections(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  teacher_code VARCHAR(100) NOT NULL REFERENCES teachers(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subject_code,section_code,teacher_code)
);

CREATE INDEX ix_subject_offerings_subject_code ON subject_offerings (subject_code);

CREATE INDEX ix_subject_offerings_section_code ON subject_offerings (section_code);

CREATE INDEX ix_subject_offerings_teacher_code ON subject_offerings (teacher_code);

CREATE TABLE student_subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  enrollment_code VARCHAR(100) NOT NULL REFERENCES student_enrollments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(enrollment_code,offering_code)
);

CREATE INDEX ix_student_subjects_enrollment_code ON student_subjects (enrollment_code);

CREATE INDEX ix_student_subjects_offering_code ON student_subjects (offering_code);

CREATE TABLE timetable_slots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  room_code VARCHAR(100) NOT NULL REFERENCES rooms(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_time > start_time),
  UNIQUE(room_code,weekday,start_time)
);

CREATE INDEX ix_timetable_slots_offering_code ON timetable_slots (offering_code);

CREATE INDEX ix_timetable_slots_room_code ON timetable_slots (room_code);

CREATE TABLE attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recorded_by_code VARCHAR(100) NOT NULL REFERENCES teachers(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_time > start_time),
  UNIQUE(offering_code,session_date,start_time)
);

CREATE INDEX ix_attendance_sessions_offering_code ON attendance_sessions (offering_code);

CREATE INDEX ix_attendance_sessions_recorded_by_code ON attendance_sessions (recorded_by_code);

CREATE TABLE student_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  session_code VARCHAR(100) NOT NULL REFERENCES attendance_sessions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_code,student_code)
);

CREATE INDEX ix_student_attendance_session_code ON student_attendance (session_code);

CREATE INDEX ix_student_attendance_student_code ON student_attendance (student_code);

CREATE TABLE employee_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('present','absent','leave','holiday','half_day')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_code,attendance_date),
  CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);

CREATE INDEX ix_employee_attendance_employee_code ON employee_attendance (employee_code);

CREATE TABLE leave_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  annual_days NUMERIC(12,2) NOT NULL CHECK (annual_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leave_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  leave_type_code VARCHAR(100) NOT NULL REFERENCES leave_types(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE INDEX ix_leave_requests_employee_code ON leave_requests (employee_code);

CREATE INDEX ix_leave_requests_leave_type_code ON leave_requests (leave_type_code);

CREATE INDEX ix_leave_requests_approved_by_code ON leave_requests (approved_by_code);

CREATE TABLE student_leave_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE INDEX ix_student_leave_requests_student_code ON student_leave_requests (student_code);

CREATE INDEX ix_student_leave_requests_approved_by_code ON student_leave_requests (approved_by_code);

CREATE TABLE admission_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  program_code VARCHAR(100) NOT NULL REFERENCES programs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  applied_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted','reviewing','offered','accepted','rejected')),
  student_code VARCHAR(100) REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_admission_applications_program_code ON admission_applications (program_code);

CREATE INDEX ix_admission_applications_academic_year_code ON admission_applications (academic_year_code);

CREATE INDEX ix_admission_applications_student_code ON admission_applications (student_code);

CREATE TABLE fee_heads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fee_structures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  program_code VARCHAR(100) NOT NULL REFERENCES programs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  fee_head_code VARCHAR(100) NOT NULL REFERENCES fee_heads(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  semester_number INTEGER NOT NULL CHECK (semester_number > 0),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  currency VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(program_code,academic_year_code,fee_head_code,semester_number)
);

CREATE INDEX ix_fee_structures_program_code ON fee_structures (program_code);

CREATE INDEX ix_fee_structures_academic_year_code ON fee_structures (academic_year_code);

CREATE INDEX ix_fee_structures_fee_head_code ON fee_structures (fee_head_code);

CREATE TABLE student_fee_charges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  fee_structure_code VARCHAR(100) NOT NULL REFERENCES fee_structures(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_code,fee_structure_code)
);

CREATE INDEX ix_student_fee_charges_student_code ON student_fee_charges (student_code);

CREATE INDEX ix_student_fee_charges_fee_structure_code ON student_fee_charges (fee_structure_code);

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(100) NOT NULL,
  paid_on DATE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','bank_transfer','upi','card','cheque')),
  transaction_reference VARCHAR(100),
  status TEXT NOT NULL CHECK (status IN ('pending','settled','failed','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_payments_student_code ON payments (student_code);

CREATE TABLE payment_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  payment_code VARCHAR(100) NOT NULL REFERENCES payments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_code,charge_code)
);

CREATE INDEX ix_payment_allocations_payment_code ON payment_allocations (payment_code);

CREATE INDEX ix_payment_allocations_charge_code ON payment_allocations (charge_code);

CREATE TABLE receipts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  payment_code VARCHAR(100) NOT NULL REFERENCES payments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  receipt_number VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_code),
  UNIQUE(receipt_number)
);

CREATE INDEX ix_receipts_payment_code ON receipts (payment_code);

CREATE TABLE refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  payment_code VARCHAR(100) NOT NULL REFERENCES payments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  refunded_on DATE NOT NULL,
  reference VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_refunds_payment_code ON refunds (payment_code);

CREATE TABLE scholarships (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sponsor TEXT,
  academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  maximum_amount NUMERIC(14,2) NOT NULL CHECK (maximum_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_scholarships_academic_year_code ON scholarships (academic_year_code);

CREATE TABLE student_scholarships (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  scholarship_code VARCHAR(100) NOT NULL REFERENCES scholarships(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','disbursed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_code,scholarship_code)
);

CREATE INDEX ix_student_scholarships_student_code ON student_scholarships (student_code);

CREATE INDEX ix_student_scholarships_scholarship_code ON student_scholarships (scholarship_code);

CREATE TABLE fee_adjustments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('discount','waiver','fine')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  approved_by_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_fee_adjustments_charge_code ON fee_adjustments (charge_code);

CREATE INDEX ix_fee_adjustments_approved_by_code ON fee_adjustments (approved_by_code);

CREATE TABLE vendors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email VARCHAR(254),
  phone VARCHAR(40),
  address TEXT,
  tax_reference VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  vendor_code VARCHAR(100) REFERENCES vendors(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(100) NOT NULL,
  expense_date DATE NOT NULL,
  approved_by_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_expenses_campus_code ON expenses (campus_code);

CREATE INDEX ix_expenses_vendor_code ON expenses (vendor_code);

CREATE INDEX ix_expenses_approved_by_code ON expenses (approved_by_code);

CREATE TABLE employee_salary_components (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  component TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('earning','deduction')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX ix_employee_salary_components_employee_code ON employee_salary_components (employee_code);

CREATE TABLE payroll_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','approved','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (period_end >= period_start)
);

CREATE INDEX ix_payroll_runs_campus_code ON payroll_runs (campus_code);

CREATE TABLE payslips (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  payroll_run_code VARCHAR(100) NOT NULL REFERENCES payroll_runs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount >= 0),
  deduction_amount NUMERIC(14,2) NOT NULL CHECK (deduction_amount >= 0),
  net_amount NUMERIC(14,2) NOT NULL CHECK (net_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payroll_run_code,employee_code),
  CHECK (net_amount = gross_amount - deduction_amount)
);

CREATE INDEX ix_payslips_payroll_run_code ON payslips (payroll_run_code);

CREATE INDEX ix_payslips_employee_code ON payslips (employee_code);

CREATE TABLE payslip_lines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  payslip_code VARCHAR(100) NOT NULL REFERENCES payslips(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  component TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('earning','deduction')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_payslip_lines_payslip_code ON payslip_lines (payslip_code);

CREATE TABLE exams (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  semester_code VARCHAR(100) NOT NULL REFERENCES semesters(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('internal','semester','practical','supplementary')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE INDEX ix_exams_semester_code ON exams (semester_code);

CREATE TABLE exam_papers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  exam_code VARCHAR(100) NOT NULL REFERENCES exams(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  room_code VARCHAR(100) REFERENCES rooms(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_marks NUMERIC(12,2) NOT NULL CHECK (max_marks >= 0),
  pass_marks NUMERIC(12,2) NOT NULL CHECK (pass_marks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (max_marks > 0 AND pass_marks <= max_marks),
  CHECK (end_time > start_time)
);

CREATE INDEX ix_exam_papers_exam_code ON exam_papers (exam_code);

CREATE INDEX ix_exam_papers_offering_code ON exam_papers (offering_code);

CREATE INDEX ix_exam_papers_room_code ON exam_papers (room_code);

CREATE TABLE exam_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  paper_code VARCHAR(100) NOT NULL REFERENCES exam_papers(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  marks NUMERIC(12,2) CHECK (marks >= 0),
  is_absent BOOLEAN NOT NULL,
  grade TEXT,
  published BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(paper_code,student_code),
  CHECK (NOT is_absent OR marks IS NULL)
);

CREATE INDEX ix_exam_results_paper_code ON exam_results (paper_code);

CREATE INDEX ix_exam_results_student_code ON exam_results (student_code);

CREATE TABLE assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  instructions TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  max_marks NUMERIC(12,2) NOT NULL CHECK (max_marks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_assignments_offering_code ON assignments (offering_code);

CREATE TABLE assignment_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  assignment_code VARCHAR(100) NOT NULL REFERENCES assignments(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ,
  document_url TEXT,
  marks NUMERIC(12,2) CHECK (marks >= 0),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_code,student_code)
);

CREATE INDEX ix_assignment_submissions_assignment_code ON assignment_submissions (assignment_code);

CREATE INDEX ix_assignment_submissions_student_code ON assignment_submissions (student_code);

CREATE TABLE learning_resources (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  offering_code VARCHAR(100) NOT NULL REFERENCES subject_offerings(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  resource_url TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document','video','link','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_learning_resources_offering_code ON learning_resources (offering_code);

CREATE TABLE hostels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  warden_employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_hostels_campus_code ON hostels (campus_code);

CREATE INDEX ix_hostels_warden_employee_code ON hostels (warden_employee_code);

CREATE TABLE hostel_rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  hostel_code VARCHAR(100) NOT NULL REFERENCES hostels(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  room_number VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hostel_code,room_number)
);

CREATE INDEX ix_hostel_rooms_hostel_code ON hostel_rooms (hostel_code);

CREATE TABLE hostel_beds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  room_code VARCHAR(100) NOT NULL REFERENCES hostel_rooms(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  bed_number VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code,bed_number)
);

CREATE INDEX ix_hostel_beds_room_code ON hostel_beds (room_code);

CREATE TABLE hostel_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  bed_code VARCHAR(100) NOT NULL REFERENCES hostel_beds(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_hostel_allocations_student_code ON hostel_allocations (student_code);

CREATE INDEX ix_hostel_allocations_bed_code ON hostel_allocations (bed_code);

CREATE TABLE hostel_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  leave_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','returned')),
  approved_by_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (return_at > leave_at)
);

CREATE INDEX ix_hostel_permissions_student_code ON hostel_permissions (student_code);

CREATE INDEX ix_hostel_permissions_approved_by_code ON hostel_permissions (approved_by_code);

CREATE TABLE vehicles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  registration_number VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  driver_employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(registration_number)
);

CREATE INDEX ix_vehicles_campus_code ON vehicles (campus_code);

CREATE INDEX ix_vehicles_driver_employee_code ON vehicles (driver_employee_code);

CREATE TABLE transport_routes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  vehicle_code VARCHAR(100) REFERENCES vehicles(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_transport_routes_campus_code ON transport_routes (campus_code);

CREATE INDEX ix_transport_routes_vehicle_code ON transport_routes (vehicle_code);

CREATE TABLE transport_stops (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  route_code VARCHAR(100) NOT NULL REFERENCES transport_routes(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  pickup_time TIME,
  drop_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_code,sequence_number)
);

CREATE INDEX ix_transport_stops_route_code ON transport_stops (route_code);

CREATE TABLE transport_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  stop_code VARCHAR(100) NOT NULL REFERENCES transport_stops(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_transport_allocations_student_code ON transport_allocations (student_code);

CREATE INDEX ix_transport_allocations_stop_code ON transport_allocations (stop_code);

CREATE TABLE library_books (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  isbn VARCHAR(100),
  publisher TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_copies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  book_code VARCHAR(100) NOT NULL REFERENCES library_books(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  accession_number VARCHAR(100) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','issued','lost','damaged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(accession_number)
);

CREATE INDEX ix_library_copies_book_code ON library_copies (book_code);

CREATE TABLE library_loans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  copy_code VARCHAR(100) NOT NULL REFERENCES library_copies(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_code VARCHAR(100) REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  issued_on DATE NOT NULL,
  due_on DATE NOT NULL,
  returned_on DATE,
  fine_amount NUMERIC(14,2) CHECK (fine_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((student_code IS NULL) <> (employee_code IS NULL)),
  CHECK (due_on >= issued_on),
  CHECK (returned_on IS NULL OR returned_on >= issued_on)
);

CREATE INDEX ix_library_loans_copy_code ON library_loans (copy_code);

CREATE INDEX ix_library_loans_student_code ON library_loans (student_code);

CREATE INDEX ix_library_loans_employee_code ON library_loans (employee_code);

CREATE TABLE inventory_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  room_code VARCHAR(100) REFERENCES rooms(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_inventory_items_campus_code ON inventory_items (campus_code);

CREATE INDEX ix_inventory_items_room_code ON inventory_items (room_code);

CREATE TABLE inventory_movements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  item_code VARCHAR(100) NOT NULL REFERENCES inventory_items(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('received','issued','returned','disposed')),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity >= 0),
  movement_date DATE NOT NULL,
  employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantity > 0)
);

CREATE INDEX ix_inventory_movements_item_code ON inventory_movements (item_code);

CREATE INDEX ix_inventory_movements_employee_code ON inventory_movements (employee_code);

CREATE TABLE certificate_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  template_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  type_code VARCHAR(100) NOT NULL REFERENCES certificate_types(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  requested_on DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','issued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_certificate_requests_student_code ON certificate_requests (student_code);

CREATE INDEX ix_certificate_requests_type_code ON certificate_requests (type_code);

CREATE TABLE certificates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  request_code VARCHAR(100) NOT NULL REFERENCES certificate_requests(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  certificate_number VARCHAR(100) NOT NULL,
  issued_on DATE NOT NULL,
  issued_by_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  verification_token VARCHAR(100) NOT NULL,
  document_url TEXT,
  revoked_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_code),
  UNIQUE(certificate_number),
  UNIQUE(verification_token)
);

CREATE INDEX ix_certificates_request_code ON certificates (request_code);

CREATE INDEX ix_certificates_issued_by_code ON certificates (issued_by_code);

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  student_code VARCHAR(100) REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  parent_code VARCHAR(100) REFERENCES parents(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email),
  CHECK (num_nonnulls(student_code,parent_code,employee_code) <= 1)
);

CREATE INDEX ix_users_student_code ON users (student_code);

CREATE INDEX ix_users_parent_code ON users (parent_code);

CREATE INDEX ix_users_employee_code ON users (employee_code);

CREATE TABLE roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

CREATE TABLE permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

CREATE TABLE user_roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  role_code VARCHAR(100) NOT NULL REFERENCES roles(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_code,role_code,campus_code)
);

CREATE INDEX ix_user_roles_user_code ON user_roles (user_code);

CREATE INDEX ix_user_roles_role_code ON user_roles (role_code);

CREATE INDEX ix_user_roles_campus_code ON user_roles (campus_code);

CREATE TABLE role_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  role_code VARCHAR(100) NOT NULL REFERENCES roles(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  permission_code VARCHAR(100) NOT NULL REFERENCES permissions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_code,permission_code)
);

CREATE INDEX ix_role_permissions_role_code ON role_permissions (role_code);

CREATE INDEX ix_role_permissions_permission_code ON role_permissions (permission_code);

CREATE TABLE refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_hash)
);

CREATE INDEX ix_refresh_tokens_user_code ON refresh_tokens (user_code);

CREATE TABLE password_reset_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_hash)
);

CREATE INDEX ix_password_reset_tokens_user_code ON password_reset_tokens (user_code);

CREATE TABLE device_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token)
);

CREATE INDEX ix_device_tokens_user_code ON device_tokens (user_code);

CREATE TABLE announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  author_code VARCHAR(100) NOT NULL REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_announcements_campus_code ON announcements (campus_code);

CREATE INDEX ix_announcements_author_code ON announcements (author_code);

CREATE TABLE announcement_recipients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  announcement_code VARCHAR(100) NOT NULL REFERENCES announcements(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(announcement_code,user_code)
);

CREATE INDEX ix_announcement_recipients_announcement_code ON announcement_recipients (announcement_code);

CREATE INDEX ix_announcement_recipients_user_code ON announcement_recipients (user_code);

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','push')),
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','read')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_notifications_user_code ON notifications (user_code);

CREATE TABLE message_threads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  created_by_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_message_threads_created_by_code ON message_threads (created_by_code);

CREATE TABLE thread_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  thread_code VARCHAR(100) NOT NULL REFERENCES message_threads(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(thread_code,user_code)
);

CREATE INDEX ix_thread_members_thread_code ON thread_members (thread_code);

CREATE INDEX ix_thread_members_user_code ON thread_members (user_code);

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  thread_code VARCHAR(100) NOT NULL REFERENCES message_threads(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  sender_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_messages_thread_code ON messages (thread_code);

CREATE INDEX ix_messages_sender_code ON messages (sender_code);

CREATE TABLE calendar_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday','academic','cultural','sports','meeting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at >= starts_at)
);

CREATE INDEX ix_calendar_events_campus_code ON calendar_events (campus_code);

CREATE TABLE placement_companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_email VARCHAR(254),
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE placement_drives (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  company_code VARCHAR(100) NOT NULL REFERENCES placement_companies(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  job_title TEXT NOT NULL,
  drive_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_placement_drives_company_code ON placement_drives (company_code);

CREATE INDEX ix_placement_drives_campus_code ON placement_drives (campus_code);

CREATE TABLE placement_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  drive_code VARCHAR(100) NOT NULL REFERENCES placement_drives(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('applied','shortlisted','selected','rejected','joined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(drive_code,student_code)
);

CREATE INDEX ix_placement_applications_drive_code ON placement_applications (drive_code);

CREATE INDEX ix_placement_applications_student_code ON placement_applications (student_code);

CREATE TABLE grievances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_grievances_user_code ON grievances (user_code);

CREATE INDEX ix_grievances_assigned_employee_code ON grievances (assigned_employee_code);

CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  parent_code VARCHAR(100) REFERENCES parents(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  verified_by_code VARCHAR(100) REFERENCES employees(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (num_nonnulls(student_code,employee_code,parent_code) = 1)
);

CREATE INDEX ix_documents_student_code ON documents (student_code);

CREATE INDEX ix_documents_employee_code ON documents (employee_code);

CREATE INDEX ix_documents_parent_code ON documents (parent_code);

CREATE INDEX ix_documents_verified_by_code ON documents (verified_by_code);

CREATE TABLE consents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  parent_code VARCHAR(100) REFERENCES parents(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_consents_student_code ON consents (student_code);

CREATE INDEX ix_consents_parent_code ON consents (parent_code);

CREATE TABLE import_jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  uploaded_by_code VARCHAR(100) NOT NULL REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  file_sha256 VARCHAR(100) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded','validated','committed','failed')),
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  successful_rows INTEGER NOT NULL CHECK (successful_rows >= 0),
  failed_rows INTEGER NOT NULL CHECK (failed_rows >= 0),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (successful_rows + failed_rows <= total_rows)
);

CREATE INDEX ix_import_jobs_uploaded_by_code ON import_jobs (uploaded_by_code);

CREATE TABLE import_rows (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  job_code VARCHAR(100) NOT NULL REFERENCES import_jobs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  sheet_name TEXT NOT NULL,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  entity_code VARCHAR(100),
  status TEXT NOT NULL CHECK (status IN ('pending','valid','invalid','imported')),
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_code,sheet_name,row_number)
);

CREATE INDEX ix_import_rows_job_code ON import_rows (job_code);

CREATE TABLE audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  actor_code VARCHAR(100) REFERENCES users(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_code VARCHAR(100) NOT NULL,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_audit_logs_actor_code ON audit_logs (actor_code);

CREATE TABLE institution_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  institution_code VARCHAR(100) NOT NULL REFERENCES institutions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_code,setting_key)
);

CREATE INDEX ix_institution_settings_institution_code ON institution_settings (institution_code);

CREATE TABLE website_pages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  institution_code VARCHAR(100) NOT NULL REFERENCES institutions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  published BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_code,slug)
);

CREATE INDEX ix_website_pages_institution_code ON website_pages (institution_code);

CREATE TABLE contact_enquiries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  institution_code VARCHAR(100) NOT NULL REFERENCES institutions(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40),
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new','responded','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_contact_enquiries_institution_code ON contact_enquiries (institution_code);

CREATE UNIQUE INDEX uq_primary_parent ON student_parents(student_code) WHERE is_primary;
CREATE UNIQUE INDEX uq_active_hostel_bed ON hostel_allocations(bed_code) WHERE end_date IS NULL;
CREATE UNIQUE INDEX uq_active_student_hostel ON hostel_allocations(student_code) WHERE end_date IS NULL;
CREATE UNIQUE INDEX uq_active_transport ON transport_allocations(student_code) WHERE end_date IS NULL;
CREATE UNIQUE INDEX uq_open_library_copy ON library_loans(copy_code) WHERE returned_on IS NULL;
CREATE FUNCTION touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE TRIGGER touch_institutions BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_campuses BEFORE UPDATE ON campuses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_academic_years BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_departments BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_programs BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_batches BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_semesters BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_sections BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_subjects BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_curriculum_subjects BEFORE UPDATE ON curriculum_subjects FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_rooms BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_teachers BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_staff_profiles BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_students BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_parents BEFORE UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_parents BEFORE UPDATE ON student_parents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_enrollments BEFORE UPDATE ON student_enrollments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_subject_offerings BEFORE UPDATE ON subject_offerings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_subjects BEFORE UPDATE ON student_subjects FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_timetable_slots BEFORE UPDATE ON timetable_slots FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_attendance_sessions BEFORE UPDATE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_attendance BEFORE UPDATE ON student_attendance FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_employee_attendance BEFORE UPDATE ON employee_attendance FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_leave_types BEFORE UPDATE ON leave_types FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_leave_requests BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_leave_requests BEFORE UPDATE ON student_leave_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_applications BEFORE UPDATE ON admission_applications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_fee_heads BEFORE UPDATE ON fee_heads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_fee_structures BEFORE UPDATE ON fee_structures FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_fee_charges BEFORE UPDATE ON student_fee_charges FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payments BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payment_allocations BEFORE UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_receipts BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_refunds BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_scholarships BEFORE UPDATE ON scholarships FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_scholarships BEFORE UPDATE ON student_scholarships FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_fee_adjustments BEFORE UPDATE ON fee_adjustments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_vendors BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_expenses BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_employee_salary_components BEFORE UPDATE ON employee_salary_components FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payroll_runs BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payslips BEFORE UPDATE ON payslips FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payslip_lines BEFORE UPDATE ON payslip_lines FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_exams BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_exam_papers BEFORE UPDATE ON exam_papers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_exam_results BEFORE UPDATE ON exam_results FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_assignments BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_assignment_submissions BEFORE UPDATE ON assignment_submissions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_learning_resources BEFORE UPDATE ON learning_resources FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostels BEFORE UPDATE ON hostels FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_rooms BEFORE UPDATE ON hostel_rooms FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_beds BEFORE UPDATE ON hostel_beds FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_allocations BEFORE UPDATE ON hostel_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_permissions BEFORE UPDATE ON hostel_permissions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_vehicles BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_transport_routes BEFORE UPDATE ON transport_routes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_transport_stops BEFORE UPDATE ON transport_stops FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_transport_allocations BEFORE UPDATE ON transport_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_library_books BEFORE UPDATE ON library_books FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_library_copies BEFORE UPDATE ON library_copies FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_library_loans BEFORE UPDATE ON library_loans FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_inventory_items BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_inventory_movements BEFORE UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_types BEFORE UPDATE ON certificate_types FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_requests BEFORE UPDATE ON certificate_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificates BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_roles BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_permissions BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_user_roles BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_role_permissions BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_refresh_tokens BEFORE UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_password_reset_tokens BEFORE UPDATE ON password_reset_tokens FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_device_tokens BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_announcements BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_announcement_recipients BEFORE UPDATE ON announcement_recipients FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_notifications BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_message_threads BEFORE UPDATE ON message_threads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_thread_members BEFORE UPDATE ON thread_members FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_messages BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_calendar_events BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_placement_companies BEFORE UPDATE ON placement_companies FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_placement_drives BEFORE UPDATE ON placement_drives FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_placement_applications BEFORE UPDATE ON placement_applications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_grievances BEFORE UPDATE ON grievances FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_documents BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_consents BEFORE UPDATE ON consents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_import_jobs BEFORE UPDATE ON import_jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_import_rows BEFORE UPDATE ON import_rows FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_audit_logs BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_institution_settings BEFORE UPDATE ON institution_settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_website_pages BEFORE UPDATE ON website_pages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_contact_enquiries BEFORE UPDATE ON contact_enquiries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- BEGIN EDUNEXA V2: admission evidence, finance controls and management mobile support.

CREATE TABLE admission_sources (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('reference','social_media','walk_in','website','campaign','other')), is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_cycles (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code), name TEXT NOT NULL, opens_on DATE NOT NULL, closes_on DATE NOT NULL, CHECK(closes_on>=opens_on),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_enquiries (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), source_code VARCHAR(100) NOT NULL REFERENCES admission_sources(code), cycle_code VARCHAR(100) REFERENCES admission_cycles(code), program_code VARCHAR(100) REFERENCES programs(code), first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(254), parent_name TEXT, parent_phone VARCHAR(40), referrer_name TEXT, campaign_reference TEXT, assigned_employee_code VARCHAR(100) REFERENCES employees(code), status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','counselling','applied','closed','not_interested')), next_follow_up_at TIMESTAMPTZ, communication_consent BOOLEAN NOT NULL DEFAULT FALSE, consent_recorded_at TIMESTAMPTZ, CHECK(NOT communication_consent OR consent_recorded_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enquiry_followups (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 enquiry_code VARCHAR(100) NOT NULL REFERENCES admission_enquiries(code), employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), occurred_at TIMESTAMPTZ NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('call','sms','email','visit','other')), outcome TEXT NOT NULL, notes TEXT, next_follow_up_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE admission_applications
 ADD COLUMN enquiry_code VARCHAR(100) REFERENCES admission_enquiries(code),
 ADD COLUMN cycle_code VARCHAR(100) REFERENCES admission_cycles(code),
 ADD COLUMN source_code VARCHAR(100) REFERENCES admission_sources(code),
 ADD COLUMN date_of_birth DATE, ADD COLUMN gender TEXT,
 ADD COLUMN admission_category TEXT NOT NULL DEFAULT 'regular' CHECK(admission_category IN ('regular','lateral_entry','transfer','readmission')),
 ADD COLUMN address JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN consent_at TIMESTAMPTZ, ADD COLUMN submitted_at TIMESTAMPTZ,
 ADD COLUMN assigned_employee_code VARCHAR(100) REFERENCES employees(code),
 ADD COLUMN submitted_by_user_code VARCHAR(100) REFERENCES users(code);
ALTER TABLE admission_applications DROP CONSTRAINT admission_applications_status_check;
ALTER TABLE admission_applications ADD CONSTRAINT admission_applications_status_check CHECK(status IN ('draft','submitted','documents_pending','reviewing','verified','offered','accepted','enrolled','rejected','withdrawn'));
CREATE UNIQUE INDEX uq_application_student ON admission_applications(student_code) WHERE student_code IS NOT NULL;
ALTER TABLE students ADD COLUMN middle_name TEXT, ADD COLUMN preferred_name TEXT,
 ADD COLUMN permanent_address JSONB, ADD COLUMN current_address_details JSONB,
 ADD COLUMN university_registration_number VARCHAR(100), ADD COLUMN admission_category TEXT,
 ADD COLUMN previous_education JSONB, ADD COLUMN profile_photo_storage_key TEXT,
 ADD COLUMN relieved_on DATE, ADD COLUMN relieving_reason TEXT,
 ADD COLUMN admission_application_code VARCHAR(100) UNIQUE REFERENCES admission_applications(code);
ALTER TABLE students DROP CONSTRAINT students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK(status IN ('active','graduated','withdrawn','suspended','relieved'));
ALTER TABLE parents ADD COLUMN work_contact JSONB, ADD COLUMN preferred_language TEXT, ADD COLUMN address_details JSONB;
ALTER TABLE employees ADD COLUMN personal_email VARCHAR(254), ADD COLUMN middle_name TEXT,
 ADD COLUMN contract_end_date DATE, ADD COLUMN confirmation_date DATE, ADD COLUMN exit_date DATE,
 ADD COLUMN reporting_employee_code VARCHAR(100) REFERENCES employees(code), ADD COLUMN address_details JSONB,
 ADD COLUMN qualifications JSONB, ADD COLUMN appointment_document_reference TEXT,
 ADD CONSTRAINT ck_employee_dates CHECK((contract_end_date IS NULL OR contract_end_date>=join_date) AND (exit_date IS NULL OR exit_date>=join_date)),
 ADD CONSTRAINT ck_no_self_reporting CHECK(reporting_employee_code IS NULL OR reporting_employee_code<>code);

CREATE TABLE application_guardians (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), relationship TEXT NOT NULL CHECK(relationship IN ('father','mother','guardian','other')), first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(254), occupation TEXT, address JSONB, is_primary BOOLEAN NOT NULL DEFAULT FALSE, parent_code VARCHAR(100) REFERENCES parents(code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_application_primary_guardian ON application_guardians(application_code) WHERE is_primary;

CREATE TABLE application_qualifications (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), qualification TEXT NOT NULL, institution TEXT NOT NULL, board_university TEXT, passing_year INTEGER CHECK(passing_year BETWEEN 1900 AND 2200), registration_number VARCHAR(100), score NUMERIC(8,2) CHECK(score>=0), score_scale TEXT CHECK(score_scale IN ('percentage','cgpa_10','gpa_4','other')), maximum_score NUMERIC(8,2), result_status TEXT NOT NULL CHECK(result_status IN ('passed','awaiting','failed')), CHECK(maximum_score IS NULL OR score<=maximum_score),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_types (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, description TEXT, accepted_mime_types TEXT[] NOT NULL DEFAULT ARRAY['application/pdf','image/jpeg','image/png'], maximum_file_bytes BIGINT NOT NULL DEFAULT 10485760 CHECK(maximum_file_bytes>0), expiry_required BOOLEAN NOT NULL DEFAULT FALSE, original_sighting_required BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE program_document_requirements (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 program_code VARCHAR(100) NOT NULL REFERENCES programs(code), academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code), document_type_code VARCHAR(100) NOT NULL REFERENCES document_types(code), admission_category TEXT NOT NULL DEFAULT 'all' CHECK(admission_category IN ('all','regular','lateral_entry','transfer','readmission')), required_stage TEXT NOT NULL CHECK(required_stage IN ('submission','offer','enrollment')), is_required BOOLEAN NOT NULL DEFAULT TRUE, waiver_allowed BOOLEAN NOT NULL DEFAULT FALSE, instructions TEXT, UNIQUE(program_code,academic_year_code,document_type_code,admission_category,required_stage),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_documents (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), document_type_code VARCHAR(100) NOT NULL REFERENCES document_types(code), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), is_current BOOLEAN NOT NULL DEFAULT TRUE, storage_key TEXT UNIQUE, original_filename TEXT, mime_type TEXT, size_bytes BIGINT CHECK(size_bytes>0), sha256 CHAR(64) CHECK(sha256 ~ '^[0-9a-f]{64}$'), issued_on DATE, expires_on DATE, uploaded_by_user_code VARCHAR(100) REFERENCES users(code), received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, received_by_employee_code VARCHAR(100) REFERENCES employees(code), status TEXT NOT NULL CHECK(status IN ('received','pending_verification','verified','rejected','waived')), original_sighted BOOLEAN NOT NULL DEFAULT FALSE, original_sighted_by_code VARCHAR(100) REFERENCES employees(code), original_sighted_at TIMESTAMPTZ, reviewed_by_employee_code VARCHAR(100) REFERENCES employees(code), reviewed_at TIMESTAMPTZ, review_notes TEXT, waiver_reason TEXT, CHECK(expires_on IS NULL OR issued_on IS NULL OR expires_on>=issued_on), CHECK(NOT original_sighted OR (original_sighted_by_code IS NOT NULL AND original_sighted_at IS NOT NULL)), CHECK(status NOT IN ('verified','rejected','waived') OR (reviewed_by_employee_code IS NOT NULL AND reviewed_at IS NOT NULL)), CHECK(status<>'waived' OR COALESCE(length(trim(waiver_reason)),0)>0), CHECK(status='waived' OR (storage_key IS NOT NULL AND original_filename IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL AND sha256 IS NOT NULL)), UNIQUE(application_code,document_type_code,revision),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_current_admission_document ON admission_documents(application_code,document_type_code) WHERE is_current;

CREATE TABLE document_verification_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 admission_document_code VARCHAR(100) NOT NULL REFERENCES admission_documents(code), actor_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), old_status TEXT, new_status TEXT NOT NULL, reason TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_reviews (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), reviewer_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), decision TEXT NOT NULL CHECK(decision IN ('pending','eligible','ineligible','hold')), eligibility_notes TEXT NOT NULL, reviewed_at TIMESTAMPTZ, CHECK(decision='pending' OR reviewed_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_status_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), old_status TEXT, new_status TEXT NOT NULL, actor_user_code VARCHAR(100) REFERENCES users(code), reason TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_offers (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), offer_number VARCHAR(100) NOT NULL UNIQUE, offered_program_code VARCHAR(100) NOT NULL REFERENCES programs(code), issued_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), issued_on DATE NOT NULL, accept_by DATE NOT NULL, status TEXT NOT NULL CHECK(status IN ('issued','accepted','declined','expired','withdrawn')), accepted_at TIMESTAMPTZ, terms TEXT, CHECK(accept_by>=issued_on), CHECK(status<>'accepted' OR accepted_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_enrollment_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL UNIQUE REFERENCES admission_applications(code), student_code VARCHAR(100) NOT NULL UNIQUE REFERENCES students(code), enrollment_code VARCHAR(100) NOT NULL UNIQUE REFERENCES student_enrollments(code), authorized_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_status_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), old_status TEXT, new_status TEXT NOT NULL, actor_user_code VARCHAR(100) REFERENCES users(code), reason TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_document_links (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), admission_document_code VARCHAR(100) NOT NULL REFERENCES admission_documents(code), transferred_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), UNIQUE(student_code,admission_document_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_parties (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, party_type TEXT NOT NULL CHECK(party_type IN ('university','examination_board','government','other')), contact_email VARCHAR(254), ledger_reference TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fee_heads ADD COLUMN collection_ownership TEXT NOT NULL DEFAULT 'internal' CHECK(collection_ownership IN ('internal','external')),
 ADD COLUMN external_party_code VARCHAR(100) REFERENCES external_parties(code), ADD COLUMN scholarship_eligible BOOLEAN NOT NULL DEFAULT TRUE,
 ADD CONSTRAINT ck_external_head_party CHECK(collection_ownership<>'external' OR external_party_code IS NOT NULL);
ALTER TABLE fee_structures DROP CONSTRAINT fee_structures_program_code_academic_year_code_fee_head_cod_key;
ALTER TABLE fee_structures ADD COLUMN installment_number INTEGER NOT NULL DEFAULT 1 CHECK(installment_number>0),
 ADD COLUMN billing_frequency TEXT NOT NULL DEFAULT 'semester' CHECK(billing_frequency IN ('one_time','annual','semester','term','monthly','per_use')),
 ADD COLUMN approval_reference TEXT,
 ADD CONSTRAINT uq_fee_structure_installment UNIQUE(program_code,academic_year_code,fee_head_code,semester_number,installment_number);
ALTER TABLE student_fee_charges ADD COLUMN tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0);
ALTER TABLE scholarships ADD COLUMN award_method TEXT NOT NULL DEFAULT 'fixed_amount' CHECK(award_method IN ('fixed_amount','percentage')),
 ADD COLUMN award_percent NUMERIC(5,2) CHECK(award_percent BETWEEN 0 AND 100), ADD COLUMN eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD CONSTRAINT ck_percent_scholarship CHECK((award_method='percentage' AND award_percent IS NOT NULL) OR (award_method='fixed_amount' AND award_percent IS NULL));

CREATE TABLE charge_scholarship_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), student_scholarship_code VARCHAR(100) NOT NULL REFERENCES student_scholarships(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), allocated_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), UNIQUE(charge_code,student_scholarship_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refund_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 refund_code VARCHAR(100) NOT NULL REFERENCES refunds(code), charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), UNIQUE(refund_code,charge_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_remittances (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 party_code VARCHAR(100) NOT NULL REFERENCES external_parties(code), campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL, paid_on DATE NOT NULL, transaction_reference TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')), expense_code VARCHAR(100) UNIQUE REFERENCES expenses(code), approved_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE remittance_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 remittance_code VARCHAR(100) NOT NULL REFERENCES external_remittances(code), charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), UNIQUE(remittance_code,charge_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_gateway_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), provider TEXT NOT NULL, provider_order_reference TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, amount NUMERIC(14,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL, status TEXT NOT NULL CHECK(status IN ('created','pending','paid','failed','cancelled')), payment_code VARCHAR(100) UNIQUE REFERENCES payments(code), UNIQUE(provider,provider_order_reference),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_gateway_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 order_code VARCHAR(100) NOT NULL REFERENCES payment_gateway_orders(code), provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, signature_verified BOOLEAN NOT NULL DEFAULT FALSE, received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMPTZ, payload_sha256 CHAR(64) NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'), status TEXT NOT NULL CHECK(status IN ('received','processed','rejected','failed')), UNIQUE(provider,provider_event_id), CHECK(status<>'processed' OR signature_verified),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fee_reminder_jobs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), parent_code VARCHAR(100) NOT NULL REFERENCES parents(code), cutoff_date DATE NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('sms','push','email')), message_template TEXT NOT NULL, consent_checked_at TIMESTAMPTZ, status TEXT NOT NULL CHECK(status IN ('queued','sent','failed','cancelled')), sent_at TIMESTAMPTZ, UNIQUE(charge_code,parent_code,channel,cutoff_date), CHECK(status<>'sent' OR (sent_at IS NOT NULL AND consent_checked_at IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_delivery_attempts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 notification_code VARCHAR(100) REFERENCES notifications(code), reminder_code VARCHAR(100) REFERENCES fee_reminder_jobs(code), provider TEXT NOT NULL, provider_message_id TEXT, attempt_number INTEGER NOT NULL CHECK(attempt_number>0), status TEXT NOT NULL CHECK(status IN ('queued','sent','delivered','failed')), attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, error_code TEXT, CHECK(num_nonnulls(notification_code,reminder_code)=1),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_download_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 certificate_code VARCHAR(100) NOT NULL REFERENCES certificates(code), user_code VARCHAR(100) NOT NULL REFERENCES users(code), downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, channel TEXT NOT NULL CHECK(channel IN ('web','parent_app','student_app','admin_app')), document_sha256 CHAR(64) NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'), request_id TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_signatures (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 certificate_code VARCHAR(100) NOT NULL UNIQUE REFERENCES certificates(code), signing_provider TEXT NOT NULL, key_reference TEXT NOT NULL, signature_algorithm TEXT NOT NULL, signed_document_storage_key TEXT NOT NULL UNIQUE, document_sha256 CHAR(64) NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'), signed_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), signed_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_tax_documents (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), financial_year VARCHAR(9) NOT NULL, document_type TEXT NOT NULL CHECK(document_type IN ('form_16','form_16a','other')), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), storage_key TEXT NOT NULL UNIQUE, sha256 CHAR(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), published_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), published_at TIMESTAMPTZ NOT NULL, UNIQUE(employee_code,financial_year,document_type,revision),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_mobile_preferences (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 user_code VARCHAR(100) NOT NULL UNIQUE REFERENCES users(code), default_campus_code VARCHAR(100) REFERENCES campuses(code), default_period TEXT NOT NULL DEFAULT 'month' CHECK(default_period IN ('day','week','month','all')), alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE, report_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_export_jobs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 requested_by_user_code VARCHAR(100) NOT NULL REFERENCES users(code), campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), report_type TEXT NOT NULL CHECK(report_type IN ('collections','outstanding','cashbook','external_remittances','expenses','payroll','admissions')), output_format TEXT NOT NULL CHECK(output_format IN ('pdf','csv','xlsx')), filters JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL CHECK(status IN ('queued','processing','ready','failed','expired')), storage_key TEXT, sha256 CHAR(64), expires_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, CHECK(status<>'ready' OR (storage_key IS NOT NULL AND completed_at IS NOT NULL AND expires_at IS NOT NULL AND sha256 IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_download_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 export_job_code VARCHAR(100) NOT NULL REFERENCES report_export_jobs(code), user_code VARCHAR(100) NOT NULL REFERENCES users(code), downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, request_id TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hostel_provision_issues (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 hostel_code VARCHAR(100) NOT NULL REFERENCES hostels(code), inventory_movement_code VARCHAR(100) NOT NULL UNIQUE REFERENCES inventory_movements(code), issued_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), received_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), issued_on DATE NOT NULL, notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hostel_permissions ADD COLUMN pickup_person_name TEXT,
 ADD COLUMN pickup_relationship TEXT CHECK(pickup_relationship IN ('parent','sibling','guardian','authorized_relative','self')),
 ADD COLUMN pickup_contact VARCHAR(40), ADD COLUMN approved_at TIMESTAMPTZ,
 ADD COLUMN departed_at TIMESTAMPTZ, ADD COLUMN returned_at TIMESTAMPTZ,
 ADD CONSTRAINT ck_hostel_approved_actor CHECK(status NOT IN ('approved','returned') OR (approved_by_code IS NOT NULL AND approved_at IS NOT NULL)),
 ADD CONSTRAINT ck_hostel_pickup_details CHECK(pickup_relationship IS NULL OR pickup_relationship='self' OR pickup_person_name IS NOT NULL),
 ADD CONSTRAINT ck_hostel_return_time CHECK(returned_at IS NULL OR (departed_at IS NOT NULL AND returned_at>=departed_at));

CREATE FUNCTION validate_admission_transition() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE required_doc RECORD; doc admission_documents%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NEW.status IN ('offered','accepted','enrolled') THEN
   IF NEW.date_of_birth IS NULL OR NEW.consent_at IS NULL OR NEW.source_code IS NULL THEN RAISE EXCEPTION 'Admission identity, consent and source are required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM application_guardians WHERE application_code=NEW.code AND is_primary) THEN RAISE EXCEPTION 'Primary application guardian is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM application_qualifications WHERE application_code=NEW.code AND result_status='passed') THEN RAISE EXCEPTION 'A passed qualifying education record is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM admission_reviews WHERE application_code=NEW.code AND decision='eligible') THEN RAISE EXCEPTION 'An eligible admission review is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM program_document_requirements WHERE program_code=NEW.program_code AND academic_year_code=NEW.academic_year_code) THEN RAISE EXCEPTION 'Program document checklist has not been configured'; END IF;
   FOR required_doc IN SELECT * FROM program_document_requirements WHERE program_code=NEW.program_code AND academic_year_code=NEW.academic_year_code AND is_required AND admission_category IN ('all',NEW.admission_category) AND (required_stage IN ('submission','offer') OR NEW.status='enrolled') LOOP
     SELECT * INTO doc FROM admission_documents WHERE application_code=NEW.code AND document_type_code=required_doc.document_type_code AND is_current;
     IF NOT FOUND OR doc.status NOT IN ('verified','waived') THEN RAISE EXCEPTION 'Required admission document % is not verified',required_doc.document_type_code; END IF;
     IF doc.status='waived' AND NOT required_doc.waiver_allowed THEN RAISE EXCEPTION 'Document waiver is not allowed'; END IF;
     IF doc.expires_on IS NOT NULL AND doc.expires_on<CURRENT_DATE THEN RAISE EXCEPTION 'Required admission document is expired'; END IF;
   END LOOP;
 END IF;
 IF NEW.status='enrolled' THEN
   IF TG_OP='INSERT' OR OLD.status<>'accepted' THEN RAISE EXCEPTION 'Enrollment requires an accepted application'; END IF;
   IF NEW.student_code IS NULL OR NOT EXISTS(SELECT 1 FROM admission_enrollment_events WHERE application_code=NEW.code AND student_code=NEW.student_code) THEN RAISE EXCEPTION 'Authorized enrollment linkage is required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_transition BEFORE INSERT OR UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION validate_admission_transition();

CREATE FUNCTION validate_admission_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE kind document_types%ROWTYPE;
BEGIN
 SELECT * INTO kind FROM document_types WHERE code=NEW.document_type_code;
 IF NEW.status<>'waived' AND (NEW.size_bytes>kind.maximum_file_bytes OR NOT NEW.mime_type=ANY(kind.accepted_mime_types)) THEN RAISE EXCEPTION 'Document type or size is not permitted'; END IF;
 IF NEW.status='verified' AND ((kind.expiry_required AND NEW.expires_on IS NULL) OR (kind.original_sighting_required AND NOT NEW.original_sighted)) THEN RAISE EXCEPTION 'Document expiry or original sighting is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_document_validation BEFORE INSERT OR UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION validate_admission_document();

CREATE FUNCTION validate_enrollment_link() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admission_applications a JOIN student_enrollments e ON e.code=NEW.enrollment_code JOIN sections sec ON sec.code=e.section_code JOIN batches b ON b.code=sec.batch_code JOIN semesters sem ON sem.code=sec.semester_code WHERE a.code=NEW.application_code AND a.status='accepted' AND e.student_code=NEW.student_code AND b.program_code=a.program_code AND sem.academic_year_code=a.academic_year_code) THEN RAISE EXCEPTION 'Enrollment student, program and academic year must match the accepted application'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER enrollment_link_validation BEFORE INSERT OR UPDATE ON admission_enrollment_events FOR EACH ROW EXECUTE FUNCTION validate_enrollment_link();

CREATE FUNCTION admission_history_record() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO admission_status_history(code,application_code,old_status,new_status,actor_user_code,reason) VALUES('AH-'||gen_random_uuid()::text,NEW.code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NULLIF(current_setting('edunexa.actor_user_code',true),''),NULLIF(current_setting('edunexa.change_reason',true),''));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER admission_history AFTER INSERT OR UPDATE ON admission_applications FOR EACH ROW EXECUTE FUNCTION admission_history_record();

CREATE FUNCTION prevent_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit history is append-only'; END; $$;
CREATE TRIGGER preserve_admission_history BEFORE UPDATE OR DELETE ON admission_status_history FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER preserve_verification_history BEFORE UPDATE OR DELETE ON document_verification_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER preserve_certificate_download_history BEFORE UPDATE OR DELETE ON certificate_download_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION validate_payment_allocation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p payments%ROWTYPE; charge_student VARCHAR(100); charge_currency VARCHAR(100); allocated NUMERIC;
BEGIN
 SELECT * INTO p FROM payments WHERE code=NEW.payment_code FOR UPDATE;
 SELECT c.student_code,f.currency INTO charge_student,charge_currency FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code WHERE c.code=NEW.charge_code;
 IF p.student_code<>charge_student OR p.currency<>charge_currency THEN RAISE EXCEPTION 'Payment and charge student/currency must match'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO allocated FROM payment_allocations WHERE payment_code=NEW.payment_code AND code<>NEW.code;
 IF NEW.amount<=0 OR allocated+NEW.amount>p.amount THEN RAISE EXCEPTION 'Allocation exceeds payment amount or is not positive'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_payment_split BEFORE INSERT OR UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation();

CREATE VIEW student_charge_balances AS
WITH adj AS (SELECT charge_code,SUM(CASE WHEN adjustment_type='fine' THEN amount ELSE -amount END) delta FROM fee_adjustments GROUP BY charge_code),
sch AS (SELECT a.charge_code,SUM(a.amount) amount FROM charge_scholarship_allocations a JOIN student_scholarships s ON s.code=a.student_scholarship_code WHERE s.status IN ('approved','disbursed') GROUP BY a.charge_code),
paid AS (SELECT a.charge_code,SUM(a.amount) amount FROM payment_allocations a JOIN payments p ON p.code=a.payment_code WHERE p.status IN ('settled','refunded') GROUP BY a.charge_code),
ref AS (SELECT charge_code,SUM(amount) amount FROM refund_allocations GROUP BY charge_code)
SELECT c.code AS charge_code,c.student_code,f.currency,c.due_date,c.amount AS base_amount,COALESCE(adj.delta,0) AS adjustment_amount,c.tax_amount,COALESCE(sch.amount,0) AS scholarship_amount,
 c.amount+COALESCE(adj.delta,0)+c.tax_amount-COALESCE(sch.amount,0) AS net_payable,
 COALESCE(paid.amount,0)-COALESCE(ref.amount,0) AS paid_net,
 c.amount+COALESCE(adj.delta,0)+c.tax_amount-COALESCE(sch.amount,0)-COALESCE(paid.amount,0)+COALESCE(ref.amount,0) AS outstanding_amount
FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code LEFT JOIN adj ON adj.charge_code=c.code LEFT JOIN sch ON sch.charge_code=c.code LEFT JOIN paid ON paid.charge_code=c.code LEFT JOIN ref ON ref.charge_code=c.code;
CREATE VIEW admin_outstanding_by_student AS SELECT student_code,currency,SUM(net_payable) net_payable,SUM(paid_net) paid_net,SUM(outstanding_amount) outstanding_amount,SUM(CASE WHEN due_date<CURRENT_DATE AND outstanding_amount>0 THEN outstanding_amount ELSE 0 END) overdue_amount FROM student_charge_balances GROUP BY student_code,currency;
CREATE VIEW certificate_download_summary AS SELECT certificate_code,COUNT(*) download_count,MAX(downloaded_at) last_downloaded_at FROM certificate_download_events GROUP BY certificate_code;

-- Keep expanded client collections intact until explicit source-to-target mappings are approved.
ALTER TABLE import_jobs ADD COLUMN contract_version TEXT NOT NULL DEFAULT '2.0', ADD COLUMN reviewed_by_user_code VARCHAR(100) REFERENCES users(code), ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE import_rows ADD COLUMN raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN mapped_data JSONB, ADD COLUMN source_headers JSONB;

CREATE FUNCTION enforce_admission_state_order() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed TEXT[];
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'draft' THEN RAISE EXCEPTION 'New applications must start as drafts'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 allowed:=CASE OLD.status
 WHEN 'draft' THEN ARRAY['submitted','withdrawn']
 WHEN 'submitted' THEN ARRAY['documents_pending','reviewing','rejected','withdrawn']
 WHEN 'documents_pending' THEN ARRAY['reviewing','rejected','withdrawn']
 WHEN 'reviewing' THEN ARRAY['documents_pending','verified','rejected','withdrawn']
 WHEN 'verified' THEN ARRAY['offered','rejected','withdrawn']
 WHEN 'offered' THEN ARRAY['accepted','rejected','withdrawn']
 WHEN 'accepted' THEN ARRAY['enrolled','withdrawn'] ELSE ARRAY[]::TEXT[] END;
 IF NOT NEW.status=ANY(allowed) THEN RAISE EXCEPTION 'Invalid admission status transition: % to %',OLD.status,NEW.status; END IF;
 IF NEW.status='offered' AND NOT EXISTS(SELECT 1 FROM admission_offers WHERE application_code=NEW.code AND status='issued') THEN RAISE EXCEPTION 'An issued admission offer is required'; END IF;
 IF NEW.status='accepted' AND NOT EXISTS(SELECT 1 FROM admission_offers WHERE application_code=NEW.code AND status='accepted' AND accept_by>=CURRENT_DATE) THEN RAISE EXCEPTION 'A valid accepted admission offer is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_state_order BEFORE INSERT OR UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION enforce_admission_state_order();

CREATE FUNCTION capture_document_review_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('verified','rejected','waived') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
  INSERT INTO document_verification_events(code,admission_document_code,actor_employee_code,old_status,new_status,reason)
  VALUES('DV-'||gen_random_uuid()::text,NEW.code,NEW.reviewed_by_employee_code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,COALESCE(NULLIF(NEW.review_notes,''),NULLIF(NEW.waiver_reason,''),'Document review recorded'));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER document_review_event AFTER INSERT OR UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION capture_document_review_event();

CREATE FUNCTION capture_student_status_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO student_status_history(code,student_code,old_status,new_status,actor_user_code,reason)
  VALUES('SH-'||gen_random_uuid()::text,NEW.code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NULLIF(current_setting('edunexa.actor_user_code',true),''),NULLIF(current_setting('edunexa.change_reason',true),''));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER student_status_event AFTER INSERT OR UPDATE ON students FOR EACH ROW EXECUTE FUNCTION capture_student_status_event();
CREATE TRIGGER preserve_student_status_history BEFORE UPDATE OR DELETE ON student_status_history FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION validate_student_document_link() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admission_documents d JOIN admission_applications a ON a.code=d.application_code WHERE d.code=NEW.admission_document_code AND a.student_code=NEW.student_code AND a.status='enrolled') THEN RAISE EXCEPTION 'Document must belong to the enrolled student application'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER student_document_link_validation BEFORE INSERT OR UPDATE ON student_document_links FOR EACH ROW EXECUTE FUNCTION validate_student_document_link();

CREATE FUNCTION guard_payment_reduction() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.amount<(SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE payment_code=OLD.code) THEN RAISE EXCEPTION 'Payment cannot be reduced below allocated total'; END IF;
 IF (NEW.student_code<>OLD.student_code OR NEW.currency<>OLD.currency) AND EXISTS(SELECT 1 FROM payment_allocations WHERE payment_code=OLD.code) THEN RAISE EXCEPTION 'Allocated payment student and currency cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER payment_reduction_guard BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION guard_payment_reduction();

CREATE FUNCTION validate_scholarship_allocation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE award student_scholarships%ROWTYPE; st VARCHAR(100); eligible BOOLEAN; total NUMERIC;
BEGIN
 SELECT * INTO award FROM student_scholarships WHERE code=NEW.student_scholarship_code FOR UPDATE;
 SELECT c.student_code,h.scholarship_eligible INTO st,eligible FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code JOIN fee_heads h ON h.code=f.fee_head_code WHERE c.code=NEW.charge_code;
 IF award.student_code<>st OR award.status NOT IN ('approved','disbursed') OR NOT eligible THEN RAISE EXCEPTION 'Scholarship must be approved, belong to student and apply to eligible head'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM charge_scholarship_allocations WHERE student_scholarship_code=award.code AND code<>NEW.code;
 IF total+NEW.amount>award.amount THEN RAISE EXCEPTION 'Scholarship allocation exceeds approved award'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER scholarship_split_validation BEFORE INSERT OR UPDATE ON charge_scholarship_allocations FOR EACH ROW EXECUTE FUNCTION validate_scholarship_allocation();

CREATE FUNCTION guard_scholarship_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM charge_scholarship_allocations WHERE student_scholarship_code=OLD.code) AND (NEW.student_code<>OLD.student_code OR NEW.status NOT IN ('approved','disbursed') OR NEW.amount<(SELECT SUM(amount) FROM charge_scholarship_allocations WHERE student_scholarship_code=OLD.code)) THEN RAISE EXCEPTION 'Scholarship change conflicts with existing charge allocations'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER scholarship_change_guard BEFORE UPDATE ON student_scholarships FOR EACH ROW EXECUTE FUNCTION guard_scholarship_change();

CREATE FUNCTION protect_verified_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('verified','waived') AND (NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.mime_type IS DISTINCT FROM OLD.mime_type OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR NEW.document_type_code<>OLD.document_type_code OR NEW.application_code<>OLD.application_code) THEN RAISE EXCEPTION 'Verified evidence cannot be replaced; upload a new document revision'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_document_evidence BEFORE UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION protect_verified_document();

CREATE FUNCTION validate_refund_split() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r refunds%ROWTYPE; payment_student VARCHAR(100); charge_student VARCHAR(100); total NUMERIC; paid_amount NUMERIC;
BEGIN
 SELECT * INTO r FROM refunds WHERE code=NEW.refund_code FOR UPDATE;
 SELECT student_code INTO payment_student FROM payments WHERE code=r.payment_code;
 SELECT student_code INTO charge_student FROM student_fee_charges WHERE code=NEW.charge_code;
 IF payment_student<>charge_student THEN RAISE EXCEPTION 'Refund and charge students must match'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM refund_allocations WHERE refund_code=NEW.refund_code AND code<>NEW.code;
 IF total+NEW.amount>r.amount THEN RAISE EXCEPTION 'Refund allocation exceeds refund amount'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO paid_amount FROM payment_allocations WHERE payment_code=r.payment_code AND charge_code=NEW.charge_code;
 SELECT COALESCE(SUM(a.amount),0) INTO total FROM refund_allocations a JOIN refunds original ON original.code=a.refund_code WHERE original.payment_code=r.payment_code AND a.charge_code=NEW.charge_code AND a.code<>NEW.code;
 IF total+NEW.amount>paid_amount THEN RAISE EXCEPTION 'Charge refunds exceed original payment allocation'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER refund_split_validation BEFORE INSERT OR UPDATE ON refund_allocations FOR EACH ROW EXECUTE FUNCTION validate_refund_split();

CREATE FUNCTION validate_remittance_split() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE rem external_remittances%ROWTYPE; party VARCHAR(100); denomination VARCHAR(100); total NUMERIC;
BEGIN
 SELECT * INTO rem FROM external_remittances WHERE code=NEW.remittance_code FOR UPDATE;
 SELECT h.external_party_code,f.currency INTO party,denomination FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code JOIN fee_heads h ON h.code=f.fee_head_code WHERE c.code=NEW.charge_code;
 IF party IS NULL OR party<>rem.party_code OR denomination<>rem.currency THEN RAISE EXCEPTION 'External party and currency must match the charge'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM remittance_allocations WHERE remittance_code=NEW.remittance_code AND code<>NEW.code;
 IF total+NEW.amount>rem.amount THEN RAISE EXCEPTION 'Remittance allocations exceed transfer amount'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER remittance_split_validation BEFORE INSERT OR UPDATE ON remittance_allocations FOR EACH ROW EXECUTE FUNCTION validate_remittance_split();

CREATE FUNCTION validate_hostel_period() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 -- Serialize changes to a bed, and to a student, before checking all date intervals.
 PERFORM 1 FROM students WHERE code=NEW.student_code FOR UPDATE;
 PERFORM 1 FROM hostel_beds WHERE code=NEW.bed_code FOR UPDATE;
 IF EXISTS(SELECT 1 FROM hostel_allocations a WHERE a.code<>NEW.code AND (a.bed_code=NEW.bed_code OR a.student_code=NEW.student_code) AND daterange(a.start_date,a.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')) THEN RAISE EXCEPTION 'Hostel bed or student allocation overlaps an existing period'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER hostel_period_validation BEFORE INSERT OR UPDATE ON hostel_allocations FOR EACH ROW EXECUTE FUNCTION validate_hostel_period();

CREATE VIEW cashbook_movements AS
SELECT p.code reference,p.paid_on movement_date,s.campus_code,p.currency,'receipt'::TEXT movement_type,p.amount receipt_amount,0::NUMERIC payment_amount
FROM payments p JOIN students s ON s.code=p.student_code WHERE p.status IN ('settled','refunded')
UNION ALL SELECT e.code,e.expense_date,e.campus_code,e.currency,'expense',0,e.amount FROM expenses e WHERE e.approved_by_code IS NOT NULL
UNION ALL SELECT r.code,r.refunded_on,s.campus_code,p.currency,'refund',0,r.amount FROM refunds r JOIN payments p ON p.code=r.payment_code JOIN students s ON s.code=p.student_code
UNION ALL SELECT r.code,r.paid_on,r.campus_code,r.currency,'external_remittance',0,r.amount FROM external_remittances r WHERE r.status='paid' AND r.expense_code IS NULL;
-- Baseline expenses do not record cash settlement status. Add it explicitly; approved is not paid.
ALTER TABLE expenses ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','void')), ADD COLUMN paid_on DATE;
CREATE OR REPLACE VIEW cashbook_movements AS
SELECT p.code reference,p.paid_on movement_date,s.campus_code,p.currency,'receipt'::TEXT movement_type,p.amount receipt_amount,0::NUMERIC payment_amount
FROM payments p JOIN students s ON s.code=p.student_code WHERE p.status IN ('settled','refunded')
UNION ALL SELECT e.code,e.paid_on,e.campus_code,e.currency,'expense',0,e.amount FROM expenses e WHERE e.payment_status='paid'
UNION ALL SELECT r.code,r.refunded_on,s.campus_code,p.currency,'refund',0,r.amount FROM refunds r JOIN payments p ON p.code=r.payment_code JOIN students s ON s.code=p.student_code
UNION ALL SELECT r.code,r.paid_on,r.campus_code,r.currency,'external_remittance',0,r.amount FROM external_remittances r WHERE r.status='paid' AND r.expense_code IS NULL;
ALTER TABLE expenses ADD CONSTRAINT ck_expense_paid_date CHECK(payment_status<>'paid' OR paid_on IS NOT NULL);
CREATE VIEW daily_finance_summary AS SELECT movement_date,campus_code,currency,SUM(receipt_amount) receipts,SUM(payment_amount) payments,SUM(receipt_amount-payment_amount) net_movement FROM cashbook_movements GROUP BY movement_date,campus_code,currency;


CREATE TRIGGER touch_admission_sources BEFORE UPDATE ON admission_sources FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_cycles BEFORE UPDATE ON admission_cycles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_enquiries BEFORE UPDATE ON admission_enquiries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_enquiry_followups BEFORE UPDATE ON enquiry_followups FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_application_guardians BEFORE UPDATE ON application_guardians FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_application_qualifications BEFORE UPDATE ON application_qualifications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_document_types BEFORE UPDATE ON document_types FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_program_document_requirements BEFORE UPDATE ON program_document_requirements FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_documents BEFORE UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_document_verification_events BEFORE UPDATE ON document_verification_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_reviews BEFORE UPDATE ON admission_reviews FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_status_history BEFORE UPDATE ON admission_status_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_offers BEFORE UPDATE ON admission_offers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_enrollment_events BEFORE UPDATE ON admission_enrollment_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_status_history BEFORE UPDATE ON student_status_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_document_links BEFORE UPDATE ON student_document_links FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_external_parties BEFORE UPDATE ON external_parties FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_charge_scholarship_allocations BEFORE UPDATE ON charge_scholarship_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_refund_allocations BEFORE UPDATE ON refund_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_external_remittances BEFORE UPDATE ON external_remittances FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_remittance_allocations BEFORE UPDATE ON remittance_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payment_gateway_orders BEFORE UPDATE ON payment_gateway_orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payment_gateway_events BEFORE UPDATE ON payment_gateway_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_fee_reminder_jobs BEFORE UPDATE ON fee_reminder_jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_notification_delivery_attempts BEFORE UPDATE ON notification_delivery_attempts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_download_events BEFORE UPDATE ON certificate_download_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_signatures BEFORE UPDATE ON certificate_signatures FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_employee_tax_documents BEFORE UPDATE ON employee_tax_documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admin_mobile_preferences BEFORE UPDATE ON admin_mobile_preferences FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_report_export_jobs BEFORE UPDATE ON report_export_jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_report_download_events BEFORE UPDATE ON report_download_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_provision_issues BEFORE UPDATE ON hostel_provision_issues FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX ix_admission_cycles_campus_code ON admission_cycles(campus_code);

CREATE INDEX ix_admission_cycles_academic_year_code ON admission_cycles(academic_year_code);

CREATE INDEX ix_admission_enquiries_campus_code ON admission_enquiries(campus_code);

CREATE INDEX ix_admission_enquiries_source_code ON admission_enquiries(source_code);

CREATE INDEX ix_admission_enquiries_cycle_code ON admission_enquiries(cycle_code);

CREATE INDEX ix_admission_enquiries_program_code ON admission_enquiries(program_code);

CREATE INDEX ix_admission_enquiries_assigned_employee_code ON admission_enquiries(assigned_employee_code);

CREATE INDEX ix_enquiry_followups_enquiry_code ON enquiry_followups(enquiry_code);

CREATE INDEX ix_enquiry_followups_employee_code ON enquiry_followups(employee_code);

CREATE INDEX ix_application_guardians_application_code ON application_guardians(application_code);

CREATE INDEX ix_application_guardians_parent_code ON application_guardians(parent_code);

CREATE INDEX ix_application_qualifications_application_code ON application_qualifications(application_code);

CREATE INDEX ix_program_document_requirements_program_code ON program_document_requirements(program_code);

CREATE INDEX ix_program_document_requirements_academic_year_code ON program_document_requirements(academic_year_code);

CREATE INDEX ix_program_document_requirements_document_type_code ON program_document_requirements(document_type_code);

CREATE INDEX ix_admission_documents_application_code ON admission_documents(application_code);

CREATE INDEX ix_admission_documents_document_type_code ON admission_documents(document_type_code);

CREATE INDEX ix_admission_documents_uploaded_by_user_code ON admission_documents(uploaded_by_user_code);

CREATE INDEX ix_admission_documents_received_by_employee_code ON admission_documents(received_by_employee_code);

CREATE INDEX ix_admission_documents_original_sighted_by_code ON admission_documents(original_sighted_by_code);

CREATE INDEX ix_admission_documents_reviewed_by_employee_code ON admission_documents(reviewed_by_employee_code);

CREATE INDEX ix_document_verification_events_admission_document_code ON document_verification_events(admission_document_code);

CREATE INDEX ix_document_verification_events_actor_employee_code ON document_verification_events(actor_employee_code);

CREATE INDEX ix_admission_reviews_application_code ON admission_reviews(application_code);

CREATE INDEX ix_admission_reviews_reviewer_employee_code ON admission_reviews(reviewer_employee_code);

CREATE INDEX ix_admission_status_history_application_code ON admission_status_history(application_code);

CREATE INDEX ix_admission_status_history_actor_user_code ON admission_status_history(actor_user_code);

CREATE INDEX ix_admission_offers_application_code ON admission_offers(application_code);

CREATE INDEX ix_admission_offers_offered_program_code ON admission_offers(offered_program_code);

CREATE INDEX ix_admission_offers_issued_by_employee_code ON admission_offers(issued_by_employee_code);

CREATE INDEX ix_admission_enrollment_events_application_code ON admission_enrollment_events(application_code);

CREATE INDEX ix_admission_enrollment_events_student_code ON admission_enrollment_events(student_code);

CREATE INDEX ix_admission_enrollment_events_enrollment_code ON admission_enrollment_events(enrollment_code);

CREATE INDEX ix_admission_enrollment_events_authorized_by_employee_code ON admission_enrollment_events(authorized_by_employee_code);

CREATE INDEX ix_student_status_history_student_code ON student_status_history(student_code);

CREATE INDEX ix_student_status_history_actor_user_code ON student_status_history(actor_user_code);

CREATE INDEX ix_student_document_links_student_code ON student_document_links(student_code);

CREATE INDEX ix_student_document_links_admission_document_code ON student_document_links(admission_document_code);

CREATE INDEX ix_student_document_links_transferred_by_employee_code ON student_document_links(transferred_by_employee_code);

CREATE INDEX ix_charge_scholarship_allocations_charge_code ON charge_scholarship_allocations(charge_code);

CREATE INDEX ix_charge_scholarship_allocations_student_scholarship_code ON charge_scholarship_allocations(student_scholarship_code);

CREATE INDEX ix_charge_scholarship_allocations_allocated_by_employee_code ON charge_scholarship_allocations(allocated_by_employee_code);

CREATE INDEX ix_refund_allocations_refund_code ON refund_allocations(refund_code);

CREATE INDEX ix_refund_allocations_charge_code ON refund_allocations(charge_code);

CREATE INDEX ix_external_remittances_party_code ON external_remittances(party_code);

CREATE INDEX ix_external_remittances_campus_code ON external_remittances(campus_code);

CREATE INDEX ix_external_remittances_expense_code ON external_remittances(expense_code);

CREATE INDEX ix_external_remittances_approved_by_employee_code ON external_remittances(approved_by_employee_code);

CREATE INDEX ix_remittance_allocations_remittance_code ON remittance_allocations(remittance_code);

CREATE INDEX ix_remittance_allocations_charge_code ON remittance_allocations(charge_code);

CREATE INDEX ix_payment_gateway_orders_student_code ON payment_gateway_orders(student_code);

CREATE INDEX ix_payment_gateway_orders_payment_code ON payment_gateway_orders(payment_code);

CREATE INDEX ix_payment_gateway_events_order_code ON payment_gateway_events(order_code);

CREATE INDEX ix_fee_reminder_jobs_charge_code ON fee_reminder_jobs(charge_code);

CREATE INDEX ix_fee_reminder_jobs_parent_code ON fee_reminder_jobs(parent_code);

CREATE INDEX ix_notification_delivery_attempts_notification_code ON notification_delivery_attempts(notification_code);

CREATE INDEX ix_notification_delivery_attempts_reminder_code ON notification_delivery_attempts(reminder_code);

CREATE INDEX ix_certificate_download_events_certificate_code ON certificate_download_events(certificate_code);

CREATE INDEX ix_certificate_download_events_user_code ON certificate_download_events(user_code);

CREATE INDEX ix_certificate_signatures_certificate_code ON certificate_signatures(certificate_code);

CREATE INDEX ix_certificate_signatures_signed_by_employee_code ON certificate_signatures(signed_by_employee_code);

CREATE INDEX ix_employee_tax_documents_employee_code ON employee_tax_documents(employee_code);

CREATE INDEX ix_employee_tax_documents_published_by_employee_code ON employee_tax_documents(published_by_employee_code);

CREATE INDEX ix_admin_mobile_preferences_user_code ON admin_mobile_preferences(user_code);

CREATE INDEX ix_admin_mobile_preferences_default_campus_code ON admin_mobile_preferences(default_campus_code);

CREATE INDEX ix_report_export_jobs_requested_by_user_code ON report_export_jobs(requested_by_user_code);

CREATE INDEX ix_report_export_jobs_campus_code ON report_export_jobs(campus_code);

CREATE INDEX ix_report_download_events_export_job_code ON report_download_events(export_job_code);

CREATE INDEX ix_report_download_events_user_code ON report_download_events(user_code);

CREATE INDEX ix_hostel_provision_issues_hostel_code ON hostel_provision_issues(hostel_code);

CREATE INDEX ix_hostel_provision_issues_inventory_movement_code ON hostel_provision_issues(inventory_movement_code);

CREATE INDEX ix_hostel_provision_issues_issued_by_employee_code ON hostel_provision_issues(issued_by_employee_code);

CREATE INDEX ix_hostel_provision_issues_received_by_employee_code ON hostel_provision_issues(received_by_employee_code);

-- BEGIN EDUNEXA V3: storage the backend's access control, sessions, form builder and login throttling need.

-- Accounts sign in with a login ID, may have no email, and are limited to specific client apps.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN login_id VARCHAR(120) NOT NULL UNIQUE,
  ADD COLUMN allowed_clients JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Screen/action grants stay in role_permissions (permission code '<screen>:<action>').
ALTER TABLE roles ADD COLUMN scope TEXT NOT NULL DEFAULT 'college' CHECK(scope IN ('college','teaching','self')),
  ADD COLUMN is_system_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_protected BOOLEAN NOT NULL DEFAULT FALSE;

-- Refresh tokens rotate within a family bound to one client; reuse revokes the family.
ALTER TABLE refresh_tokens ADD COLUMN family_code VARCHAR(100) NOT NULL,
  ADD COLUMN client_id TEXT NOT NULL CHECK(client_id IN ('admin-web','admin-mobile','teacher-mobile','parent-mobile','student-mobile'));

CREATE TABLE form_definitions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, screen VARCHAR(100) NOT NULL, fields JSONB NOT NULL,
 is_published BOOLEAN NOT NULL DEFAULT FALSE, revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by_user_code VARCHAR(100) REFERENCES users(code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_published_form_screen ON form_definitions(screen) WHERE is_published;

-- Each submission keeps the definition it was validated against.
CREATE TABLE form_submissions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 form_code VARCHAR(100) NOT NULL REFERENCES form_definitions(code), revision INTEGER NOT NULL CHECK(revision>0),
 definition JSONB NOT NULL, submitted_values JSONB NOT NULL,
 submitted_by_user_code VARCHAR(100) REFERENCES users(code), submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Failed sign-in and public-intake attempts per hashed login or IP, for 15-minute throttling windows.
CREATE TABLE login_attempts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 attempt_key CHAR(64) NOT NULL CHECK(attempt_key ~ '^[0-9a-f]{64}$'),
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER touch_form_definitions BEFORE UPDATE ON form_definitions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_form_submissions BEFORE UPDATE ON form_submissions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_login_attempts BEFORE UPDATE ON login_attempts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX ix_refresh_tokens_family_code ON refresh_tokens(family_code);
CREATE INDEX ix_form_definitions_updated_by_user_code ON form_definitions(updated_by_user_code);
CREATE INDEX ix_form_submissions_form_code ON form_submissions(form_code);
CREATE INDEX ix_form_submissions_submitted_by_user_code ON form_submissions(submitted_by_user_code);
CREATE INDEX ix_login_attempts_key_time ON login_attempts(attempt_key, attempted_at);

-- BEGIN EDUNEXA V4: align the schema with what the backend workflows persist (backend SQL store).

-- 1. Tables the backend screens use that the reference schema did not have.
CREATE TABLE purchase_requests (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 title TEXT NOT NULL, employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected')), requested_on DATE NOT NULL, description TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE purchase_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 request_code VARCHAR(100) NOT NULL REFERENCES purchase_requests(code), vendor_code VARCHAR(100) NOT NULL REFERENCES vendors(code),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('ordered','received','paid')), ordered_on DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE asset_register (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, item_code VARCHAR(100) NOT NULL REFERENCES inventory_items(code), serial_number TEXT NOT NULL,
 assigned_employee_code VARCHAR(100) REFERENCES employees(code),
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','assigned','maintenance','retired')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicle_trips (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 route_code VARCHAR(100) NOT NULL REFERENCES transport_routes(code), trip_date DATE NOT NULL,
 driver_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','departed','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicle_maintenance (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 vehicle_code VARCHAR(100) NOT NULL REFERENCES vehicles(code), service_date DATE NOT NULL, description TEXT NOT NULL,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicle_fuel (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 vehicle_code VARCHAR(100) NOT NULL REFERENCES vehicles(code), filled_on DATE NOT NULL,
 litres NUMERIC(12,2) NOT NULL CHECK(litres>0), amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), odometer NUMERIC(12,2) NOT NULL CHECK(odometer>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicle_seats (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 vehicle_code VARCHAR(100) NOT NULL REFERENCES vehicles(code), seat_number VARCHAR(20) NOT NULL,
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','unavailable')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(vehicle_code,seat_number)
);
CREATE TABLE passenger_seats (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 seat_code VARCHAR(100) NOT NULL REFERENCES vehicle_seats(code), student_code VARCHAR(100) REFERENCES students(code),
 employee_code VARCHAR(100) REFERENCES employees(code), route_code VARCHAR(100) NOT NULL REFERENCES transport_routes(code),
 start_date DATE NOT NULL, end_date DATE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(num_nonnulls(student_code,employee_code)=1), CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE TABLE transport_attendance (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 trip_code VARCHAR(100) NOT NULL REFERENCES vehicle_trips(code), student_code VARCHAR(100) REFERENCES students(code),
 employee_code VARCHAR(100) REFERENCES employees(code), status TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(num_nonnulls(student_code,employee_code)=1)
);
CREATE TABLE timetable_swap_requests (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 slot_code VARCHAR(100) NOT NULL REFERENCES timetable_slots(code), target_slot_code VARCHAR(100) NOT NULL REFERENCES timetable_slots(code),
 requested_by_user_code VARCHAR(100) NOT NULL REFERENCES users(code), reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(slot_code<>target_slot_code)
);
CREATE TABLE payroll_adjustments (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), component TEXT NOT NULL, component_type TEXT NOT NULL,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), payroll_run_code VARCHAR(100) REFERENCES payroll_runs(code),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE college_invoices (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) REFERENCES students(code), vendor_code VARCHAR(100) REFERENCES vendors(code),
 invoice_number VARCHAR(100) NOT NULL UNIQUE, amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), due_date DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','paid','void')), description TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notification_templates (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, channel TEXT NOT NULL, body TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notification_campaigns (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, template_code VARCHAR(100) NOT NULL REFERENCES notification_templates(code), scheduled_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','sent','failed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE expense_payment_entries (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 expense_code VARCHAR(100) NOT NULL REFERENCES expenses(code), method TEXT NOT NULL, reference TEXT NOT NULL,
 paid_on DATE NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fields outside a table's columns (custom form bindings, retained import columns), one JSON object per record.
CREATE TABLE record_extras (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 table_name VARCHAR(128) NOT NULL, record_code VARCHAR(100) NOT NULL, data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(table_name,record_code)
);

-- 2. Workflow states the backend uses.
ALTER TABLE hostel_permissions DROP CONSTRAINT hostel_permissions_status_check;
ALTER TABLE hostel_permissions ADD CONSTRAINT hostel_permissions_status_check CHECK(status IN ('requested','pending','approved','rejected','departed','returned'));
-- Pickup relationship is captured as free text (e.g. "Father"); 'self' keeps its special meaning.
ALTER TABLE hostel_permissions DROP CONSTRAINT hostel_permissions_pickup_relationship_check;
ALTER TABLE payroll_runs DROP CONSTRAINT payroll_runs_status_check;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK(status IN ('draft','pending','calculated','published','approved','paid'));
ALTER TABLE certificate_download_events DROP CONSTRAINT certificate_download_events_channel_check;
ALTER TABLE certificate_download_events ADD CONSTRAINT certificate_download_events_channel_check CHECK(channel IN ('web','parent_app','student_app','admin_app','admin-web','admin-mobile','teacher-mobile','parent-mobile','student-mobile'));

-- 3. Values the workflows store.
ALTER TABLE certificate_signatures ADD COLUMN signature TEXT, ADD COLUMN public_key TEXT;
ALTER TABLE certificates ADD COLUMN storage_key VARCHAR(255);
ALTER TABLE import_jobs ADD COLUMN errors JSONB, ADD COLUMN staged_rows JSONB;
ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(200) UNIQUE, ADD COLUMN request JSONB;
ALTER TABLE refresh_tokens ADD COLUMN used_at TIMESTAMPTZ;
ALTER TABLE form_submissions ADD COLUMN entity_code VARCHAR(100);

-- 4. Access control: roles may be granted without a campus; audit actors include non-account callers
-- (public intake, providers); throttle keys are prefixed digests such as 'ip:<sha256>'.
ALTER TABLE user_roles ALTER COLUMN campus_code DROP NOT NULL;
ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_actor_code_fkey;
ALTER TABLE login_attempts DROP CONSTRAINT login_attempts_attempt_key_check;
ALTER TABLE login_attempts ALTER COLUMN attempt_key TYPE VARCHAR(200);

-- 5. The backend writes status/verification history itself, with actor and reason; the database
-- capture triggers would duplicate every row. Append-only protection stays.
DROP TRIGGER admission_history ON admission_applications;
DROP TRIGGER document_review_event ON admission_documents;
DROP TRIGGER student_status_event ON students;
DROP FUNCTION admission_history_record();
DROP FUNCTION capture_document_review_event();
DROP FUNCTION capture_student_status_event();

CREATE TRIGGER touch_purchase_requests BEFORE UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_purchase_orders BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_asset_register BEFORE UPDATE ON asset_register FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_vehicle_trips BEFORE UPDATE ON vehicle_trips FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_vehicle_maintenance BEFORE UPDATE ON vehicle_maintenance FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_vehicle_fuel BEFORE UPDATE ON vehicle_fuel FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_vehicle_seats BEFORE UPDATE ON vehicle_seats FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_passenger_seats BEFORE UPDATE ON passenger_seats FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_transport_attendance BEFORE UPDATE ON transport_attendance FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_timetable_swap_requests BEFORE UPDATE ON timetable_swap_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_payroll_adjustments BEFORE UPDATE ON payroll_adjustments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_college_invoices BEFORE UPDATE ON college_invoices FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_notification_templates BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_notification_campaigns BEFORE UPDATE ON notification_campaigns FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_expense_payment_entries BEFORE UPDATE ON expense_payment_entries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_record_extras BEFORE UPDATE ON record_extras FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX ix_purchase_requests_employee_code ON purchase_requests(employee_code);
CREATE INDEX ix_purchase_orders_request_code ON purchase_orders(request_code);
CREATE INDEX ix_purchase_orders_vendor_code ON purchase_orders(vendor_code);
CREATE INDEX ix_asset_register_item_code ON asset_register(item_code);
CREATE INDEX ix_asset_register_assigned_employee_code ON asset_register(assigned_employee_code);
CREATE INDEX ix_vehicle_trips_route_code ON vehicle_trips(route_code);
CREATE INDEX ix_vehicle_trips_driver_employee_code ON vehicle_trips(driver_employee_code);
CREATE INDEX ix_vehicle_maintenance_vehicle_code ON vehicle_maintenance(vehicle_code);
CREATE INDEX ix_vehicle_fuel_vehicle_code ON vehicle_fuel(vehicle_code);
CREATE INDEX ix_passenger_seats_seat_code ON passenger_seats(seat_code);
CREATE INDEX ix_passenger_seats_student_code ON passenger_seats(student_code);
CREATE INDEX ix_passenger_seats_employee_code ON passenger_seats(employee_code);
CREATE INDEX ix_passenger_seats_route_code ON passenger_seats(route_code);
CREATE INDEX ix_transport_attendance_trip_code ON transport_attendance(trip_code);
CREATE INDEX ix_transport_attendance_student_code ON transport_attendance(student_code);
CREATE INDEX ix_transport_attendance_employee_code ON transport_attendance(employee_code);
CREATE INDEX ix_timetable_swap_requests_slot_code ON timetable_swap_requests(slot_code);
CREATE INDEX ix_timetable_swap_requests_target_slot_code ON timetable_swap_requests(target_slot_code);
CREATE INDEX ix_timetable_swap_requests_requested_by_user_code ON timetable_swap_requests(requested_by_user_code);
CREATE INDEX ix_payroll_adjustments_employee_code ON payroll_adjustments(employee_code);
CREATE INDEX ix_payroll_adjustments_payroll_run_code ON payroll_adjustments(payroll_run_code);
CREATE INDEX ix_college_invoices_student_code ON college_invoices(student_code);
CREATE INDEX ix_college_invoices_vendor_code ON college_invoices(vendor_code);
CREATE INDEX ix_notification_campaigns_template_code ON notification_campaigns(template_code);
CREATE INDEX ix_expense_payment_entries_expense_code ON expense_payment_entries(expense_code);

-- BEGIN EDUNEXA V5: admission status rules apply to status changes, not to inserts.
-- Online applications are created as 'submitted', and imports or data migration insert existing
-- applications at their recorded status; the backend validates those inserts. Every later status
-- change is still checked against the transition graph and its document/offer requirements.

DROP TRIGGER admission_state_order ON admission_applications;
DROP TRIGGER admission_transition ON admission_applications;
CREATE TRIGGER admission_state_order BEFORE UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION enforce_admission_state_order();
CREATE TRIGGER admission_transition BEFORE UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION validate_admission_transition();

-- BEGIN EDUNEXA V6: enable row level security on every EduNexa table and view.
-- Supabase publishes the public schema through its Data API (PostgREST) to the anon and
-- authenticated roles. EduNexa clients go through the backend, which connects as the table
-- owner and is not subject to these policies; with RLS on and no policies, the Data API sees
-- no rows. Views run with the caller's rights (security_invoker) so they cannot bypass RLS.
-- Tables and views added by later migrations must do the same.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c
           WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
  FOR t IN SELECT c.relname FROM pg_class c
           WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', t.relname);
  END LOOP;
END $$;

-- BEGIN EDUNEXA V7: student enrollment wizard, course levels and branches, fee categories.

-- 1. Courses are Intermediate or Degree programmes with a branch (MPC, BPC, Computers, ...).
ALTER TABLE programs
  ADD COLUMN course_level TEXT CHECK (course_level IN ('intermediate','degree')),
  ADD COLUMN branch TEXT;
CREATE INDEX ix_programs_course_level ON programs(course_level);

-- 2. Fee heads say which fees every student pays and which only hostel or bus users pay.
ALTER TABLE fee_heads
  ADD COLUMN category TEXT NOT NULL DEFAULT 'academic' CHECK (category IN ('academic','hostel','transport','other'));

-- 3. Identity and year of study.
ALTER TABLE students
  ADD COLUMN aadhaar_number VARCHAR(12) UNIQUE CHECK (aadhaar_number ~ '^[0-9]{12}$'),
  ADD COLUMN current_year SMALLINT CHECK (current_year BETWEEN 1 AND 10);

-- 4. The admission profile captured by the enrollment wizard (one per student).
CREATE TABLE student_admission_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  student_code VARCHAR(100) NOT NULL UNIQUE REFERENCES students(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  program_code VARCHAR(100) NOT NULL REFERENCES programs(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  batch_code VARCHAR(100) REFERENCES batches(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  section_code VARCHAR(100) REFERENCES sections(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  course_level TEXT NOT NULL CHECK (course_level IN ('intermediate','degree')),
  registration_number VARCHAR(100) NOT NULL UNIQUE,
  last_qualification JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(last_qualification) = 'object'),
  referral JSONB CHECK (referral IS NULL OR jsonb_typeof(referral) = 'object'),
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(achievements) = 'array'),
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(certifications) = 'array'),
  document_checklist JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(document_checklist) = 'object'),
  hostel_required BOOLEAN NOT NULL DEFAULT FALSE,
  transport_required BOOLEAN NOT NULL DEFAULT FALSE,
  scholarship_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (scholarship_amount >= 0),
  scholarship_name TEXT,
  special_consideration_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (special_consideration_amount >= 0),
  special_consideration_reason TEXT,
  gross_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gross_fee >= 0),
  net_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (net_fee >= 0),
  fee_summary JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fee_summary) = 'array'),
  created_by_user_code VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (special_consideration_amount = 0 OR special_consideration_reason IS NOT NULL)
);
CREATE INDEX ix_student_admission_profiles_program_code ON student_admission_profiles(program_code);
CREATE INDEX ix_student_admission_profiles_academic_year_code ON student_admission_profiles(academic_year_code);
CREATE TRIGGER touch_student_admission_profiles BEFORE UPDATE ON student_admission_profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- Supabase: like every EduNexa table, invisible to the public Data API (see V6).
ALTER TABLE student_admission_profiles ENABLE ROW LEVEL SECURITY;

-- BEGIN EDUNEXA V8: course catalog details shown on course cards and in the enrollment wizard.
ALTER TABLE programs
  ADD COLUMN category TEXT,
  ADD COLUMN duration_label TEXT,
  ADD COLUMN semesters_label TEXT,
  ADD COLUMN career_opportunities TEXT,
  ADD COLUMN subjects TEXT;
CREATE INDEX ix_programs_category ON programs(category);

-- BEGIN EDUNEXA SEED DATA
-- Reference data of the college: institution, campus, departments (one per course family)
-- and the course catalog (Intermediate groups and degree courses). Generated by
-- backend/tools/export_seed_sql.py from the live database; existing codes are skipped.

-- institutions: 1
INSERT INTO institutions (code, name, email, phone, address, city, state, postal_code, country, website, affiliation) VALUES
  ('INST-PRAGATHI', 'Pragathi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- campuses: 1
INSERT INTO campuses (code, institution_code, name, address, city, state, postal_code) VALUES
  ('CAMP-MAIN-CAMPUS', 'INST-PRAGATHI', 'Main Campus', NULL, NULL, NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- departments: 10
INSERT INTO departments (code, campus_code, name) VALUES
  ('DEP-AGRICULTURE-AND-RELATED-NON-MEDICAL-FIELDS', 'CAMP-MAIN-CAMPUS', 'Agriculture and Related Non-Medical Fields'),
  ('DEP-ARTS-HUMANITIES-AND-SOCIAL-SCIENCES', 'CAMP-MAIN-CAMPUS', 'Arts, Humanities and Social Sciences'),
  ('DEP-COMMERCE-FINANCE-AND-MANAGEMENT', 'CAMP-MAIN-CAMPUS', 'Commerce, Finance and Management'),
  ('DEP-DESIGN-ARCHITECTURE-AND-CREATIVE-ARTS', 'CAMP-MAIN-CAMPUS', 'Design, Architecture and Creative Arts'),
  ('DEP-EDUCATION-AND-TEACHING', 'CAMP-MAIN-CAMPUS', 'Education and Teaching'),
  ('DEP-HOSPITALITY-TOURISM-AVIATION-AND-LOGISTICS', 'CAMP-MAIN-CAMPUS', 'Hospitality, Tourism, Aviation and Logistics'),
  ('DEP-INTERMEDIATE-CLASS-11-AND-12', 'CAMP-MAIN-CAMPUS', 'Intermediate (Class 11 and 12)'),
  ('DEP-LAW-AND-LEGAL-STUDIES', 'CAMP-MAIN-CAMPUS', 'Law and Legal Studies'),
  ('DEP-SCIENCE-AND-COMPUTER-APPLICATIONS', 'CAMP-MAIN-CAMPUS', 'Science and Computer Applications'),
  ('DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'CAMP-MAIN-CAMPUS', 'Vocational and Industry-Oriented Degrees')
ON CONFLICT (code) DO NOTHING;

-- programs: 130
INSERT INTO programs (code, department_code, name, qualification, course_level, branch, category, duration_label, semesters_label, duration_semesters, intake_capacity, subjects, career_opportunities) VALUES
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
  ('DEG-BACHELOR-OF-PACKAGING-TECHNOLOGY', 'DEP-VOCATIONAL-AND-INDUSTRY-ORIENTED-DEGREES', 'Bachelor of Packaging Technology', 'Bachelor of Packaging Technology', 'degree', NULL, 'Vocational and Industry-Oriented Degrees', '3–4 years', '6–8', 6, NULL, NULL, 'Packaging design and quality')
ON CONFLICT (code) DO NOTHING;
-- END EDUNEXA SEED DATA

COMMIT;
