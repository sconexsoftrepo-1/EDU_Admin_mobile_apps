# Admission-number format

The Student enrollment wizard now allocates **YY + course type + branch code + sequence**.
For example, `26INTMPC0001` means academic year starting in **2026**, **Intermediate**, branch
**MPC**, student sequence **0001**. `26DEGCS0001` is a degree course with branch code CS.

- Course type is `INT` for `course_level=intermediate`, `DEG` for `course_level=degree`.
- `programs.branch_code` is the stable, editable branch identifier (1–40 letters/digits,
  normalized to uppercase). It appears in course creation/edit fields and course details.
- If a course has no configured branch code, the backend derives one from its unique program
  code, stripping an initial `INT-`/`INT_` or `DEG-`/`DEG_` and removing separators. Thus
  `INT-MPC` becomes MPC and `DEG-BSC-CS` becomes BSCCS. An explicit branch code CS takes precedence.
- Branch codes must be unique within a course type. The backend rejects conflicting course
  configurations before issuing admission numbers. Display-name edits do not change branch codes.
- The sequence starts at 0001 for a year/course/branch prefix and follows the highest existing
  numeric suffix. It grows past 9999 without truncation. Legacy `ADM-...` values do not match
  the new prefixes.
- Options/preview calls do not reserve numbers. Confirmation recalculates inside the store's
  write transaction. Local JSON uses a file lock; SQL Server uses its transaction-scoped app
  lock; PostgreSQL uses its transaction-scoped advisory lock. The database also has the existing
  unique constraint on `students.admission_number`.
- Registration numbers and roll numbers keep their existing format; this change concerns
  admission numbers. Admissions imported or entered through other legacy/manual APIs retain
  their supplied identifiers; use the enrollment wizard for this automatic numbering rule.

## Persistence

The generated number is stored in `students.admission_number`. A configured/generated branch
code is saved with its `programs` record; when there is no physical `branch_code` column, the
existing SQL adapter persists it in `record_extras` (`table_name=programs`). A course without
saved branch metadata can still be numbered using its program code. No table rebuild is needed.

## Existing students

The new generator does not automatically renumber students already enrolled. Preview the
existing-data mapping from `backend/`:

```sh
.venv/bin/python tools/format_admission_numbers.py
```

Once existing-student renumbering has been authorized, apply the mapping atomically:

```sh
.venv/bin/python tools/format_admission_numbers.py --apply
```

The tool discovers a student's course from their admission profile, application or enrollment.
It uses the academic year's start year, falling back to admission date when academic year is
unavailable. It refuses to apply if a student's course/level/year cannot be resolved. Old numbers
are kept in `students.admission_number_history` through `record_extras`, and changes are audited.
Student codes, registrations, relationships, and existing S3 paths remain intact. New uploads
use the student's currently stored admission number when constructing their folder.
