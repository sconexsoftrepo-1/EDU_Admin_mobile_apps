-- EduNexa College development schema, PostgreSQL 16+. Fresh database only.

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
  semester_code VARCHAR(100) NOT NULL REFERENCES semesters(code) ON UPDATE CASCADE ON DELETE RESTRICT,
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

COMMIT;
