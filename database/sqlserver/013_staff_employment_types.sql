-- Align SQL Server with the staff onboarding contract. Run transactionally with
-- backend/tools/setup_staff_schema.py; existing employee records are retained.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.employees') AND name = N'employees_employee_type_check')
    ALTER TABLE dbo.employees DROP CONSTRAINT employees_employee_type_check;
ALTER TABLE dbo.employees WITH CHECK ADD CONSTRAINT employees_employee_type_check
    CHECK (employee_type COLLATE Latin1_General_BIN2 IN (N'teacher', N'staff', N'labour'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.employees') AND name = N'employees_employment_type_check')
    ALTER TABLE dbo.employees DROP CONSTRAINT employees_employment_type_check;
ALTER TABLE dbo.employees WITH CHECK ADD CONSTRAINT employees_employment_type_check
    CHECK (employment_type COLLATE Latin1_General_BIN2 IN (N'permanent', N'contract', N'part_time', N'daily_wage'));
