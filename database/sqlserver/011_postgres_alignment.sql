CREATE TABLE dbo.[employee_profiles] ([id] BIGINT IDENTITY(1,1) PRIMARY KEY NOT NULL,
[code] NVARCHAR(100) NOT NULL,
[employee_code] NVARCHAR(100) NOT NULL,
[staff_kind] NVARCHAR(MAX) NOT NULL,
[qualification_level] NVARCHAR(MAX) NULL,
[specialization] NVARCHAR(MAX) NULL,
[aadhaar_number] NVARCHAR(12) NULL,
[pan_number] NVARCHAR(10) NULL,
[bank_account_holder] NVARCHAR(MAX) NULL,
[bank_account_number] NVARCHAR(34) NULL,
[bank_name] NVARCHAR(MAX) NULL,
[bank_ifsc] NVARCHAR(11) NULL,
[bank_branch] NVARCHAR(MAX) NULL,
[qualification_certificates] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([qualification_certificates] IS NULL OR ISJSON([qualification_certificates])=1),
[previous_experience] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([previous_experience] IS NULL OR ISJSON([previous_experience])=1),
[employment_history] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([employment_history] IS NULL OR ISJSON([employment_history])=1),
[achievements] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([achievements] IS NULL OR ISJSON([achievements])=1),
[document_checklist] NVARCHAR(MAX) NOT NULL DEFAULT '{}',
CHECK ([document_checklist] IS NULL OR ISJSON([document_checklist])=1),
[salary_basis] NVARCHAR(MAX) NOT NULL DEFAULT 'monthly',
[salary_amount] DECIMAL(14,2) NULL,
[ctc_annual] DECIMAL(14,2) NULL,
[gross_monthly] DECIMAL(14,2) NULL,
[deductions_monthly] DECIMAL(14,2) NULL,
[net_monthly] DECIMAL(14,2) NULL,
[in_hand_monthly] DECIMAL(14,2) NULL,
[created_by_user_code] NVARCHAR(100) NULL,
[created_at] DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
[updated_at] DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET());
CREATE UNIQUE INDEX [employee_profiles_aadhaar_number_key] ON dbo.[employee_profiles] ([aadhaar_number]) WHERE [aadhaar_number] IS NOT NULL;
CREATE UNIQUE INDEX [employee_profiles_code_key] ON dbo.[employee_profiles] ([code]);
CREATE UNIQUE INDEX [employee_profiles_employee_code_key] ON dbo.[employee_profiles] ([employee_code]);
CREATE UNIQUE INDEX [employee_profiles_pan_number_key] ON dbo.[employee_profiles] ([pan_number]) WHERE [pan_number] IS NOT NULL;
ALTER TABLE dbo.[employees] ALTER COLUMN [email] NVARCHAR(254) NULL;
ALTER TABLE dbo.[employees] ALTER COLUMN [phone] NVARCHAR(40) NULL;
ALTER TABLE dbo.[fee_heads] ADD [category] NVARCHAR(MAX) NOT NULL DEFAULT 'academic';
ALTER TABLE dbo.[programs] ADD [course_level] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [branch] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [category] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [duration_label] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [semesters_label] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [career_opportunities] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[programs] ADD [subjects] NVARCHAR(MAX) NULL;
ALTER TABLE dbo.[sections] ALTER COLUMN [semester_code] NVARCHAR(100) NULL;
CREATE TABLE dbo.[student_admission_profiles] ([id] BIGINT IDENTITY(1,1) PRIMARY KEY NOT NULL,
[code] NVARCHAR(100) NOT NULL,
[student_code] NVARCHAR(100) NOT NULL,
[program_code] NVARCHAR(100) NOT NULL,
[academic_year_code] NVARCHAR(100) NOT NULL,
[batch_code] NVARCHAR(100) NULL,
[section_code] NVARCHAR(100) NULL,
[course_level] NVARCHAR(MAX) NOT NULL,
[registration_number] NVARCHAR(100) NOT NULL,
[last_qualification] NVARCHAR(MAX) NOT NULL DEFAULT '{}',
CHECK ([last_qualification] IS NULL OR ISJSON([last_qualification])=1),
[referral] NVARCHAR(MAX) NULL,
CHECK ([referral] IS NULL OR ISJSON([referral])=1),
[achievements] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([achievements] IS NULL OR ISJSON([achievements])=1),
[certifications] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([certifications] IS NULL OR ISJSON([certifications])=1),
[document_checklist] NVARCHAR(MAX) NOT NULL DEFAULT '{}',
CHECK ([document_checklist] IS NULL OR ISJSON([document_checklist])=1),
[hostel_required] BIT NOT NULL DEFAULT 0,
[transport_required] BIT NOT NULL DEFAULT 0,
[scholarship_amount] DECIMAL(14,2) NOT NULL DEFAULT 0,
[scholarship_name] NVARCHAR(MAX) NULL,
[special_consideration_amount] DECIMAL(14,2) NOT NULL DEFAULT 0,
[special_consideration_reason] NVARCHAR(MAX) NULL,
[gross_fee] DECIMAL(14,2) NOT NULL DEFAULT 0,
[net_fee] DECIMAL(14,2) NOT NULL DEFAULT 0,
[fee_summary] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
CHECK ([fee_summary] IS NULL OR ISJSON([fee_summary])=1),
[created_by_user_code] NVARCHAR(100) NULL,
[created_at] DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
[updated_at] DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET());
CREATE UNIQUE INDEX [student_admission_profiles_code_key] ON dbo.[student_admission_profiles] ([code]);
CREATE UNIQUE INDEX [student_admission_profiles_registration_number_key] ON dbo.[student_admission_profiles] ([registration_number]);
CREATE UNIQUE INDEX [student_admission_profiles_student_code_key] ON dbo.[student_admission_profiles] ([student_code]);
ALTER TABLE dbo.[students] ADD [aadhaar_number] NVARCHAR(12) NULL;
CREATE UNIQUE INDEX [students_aadhaar_number_key] ON dbo.[students] ([aadhaar_number]) WHERE [aadhaar_number] IS NOT NULL;
ALTER TABLE dbo.[students] ADD [current_year] SMALLINT NULL;
ALTER TABLE dbo.[student_admission_profiles] ADD FOREIGN KEY ([student_code]) REFERENCES dbo.[students] ([code]);
ALTER TABLE dbo.[student_admission_profiles] ADD FOREIGN KEY ([program_code]) REFERENCES dbo.[programs] ([code]);
ALTER TABLE dbo.[student_admission_profiles] ADD FOREIGN KEY ([academic_year_code]) REFERENCES dbo.[academic_years] ([code]);
ALTER TABLE dbo.[student_admission_profiles] ADD FOREIGN KEY ([batch_code]) REFERENCES dbo.[batches] ([code]);
ALTER TABLE dbo.[student_admission_profiles] ADD FOREIGN KEY ([section_code]) REFERENCES dbo.[sections] ([code]);
ALTER TABLE dbo.[employee_profiles] ADD FOREIGN KEY ([employee_code]) REFERENCES dbo.[employees] ([code]);
