# Attendance workspace

All updated clients use `/api/v1/academics/attendance-workspace`. The admin dashboard's Student attendance screen, teacher mobile Attendance hub, and student/parent Attendance hubs share this API. Family home dashboards also load their attendance overview from it.

## Endpoints

- `GET /options`: authorized course levels, courses/branches, academic batches, sections, linked children, period choices, and marking permissions.
- `GET /?program_code=…&academic_year_code=…&section_code=…&on=YYYY-MM-DD&period=1`: the class roster, registers for the selected calendar year (plus any days needed for its overlapping week), period/day/week/month/year summaries, the selected month's calendar, and approved leave dates per visible student. Course and batch are required for staff. Students/parents omit class filters and may select only themselves/a linked child with `student_code`.
- `PUT /register`: saves an attendance register atomically. Example body:

```json
{
  "program_code": "BSC-CS",
  "academic_year_code": "BSC-2026-2029",
  "section_code": "BSC-A",
  "session_date": "2026-10-30",
  "period": 1,
  "subject": "Computer science",
  "revision": 0,
  "marks": [
    {"student_code": "STU-001", "status": "present"},
    {"student_code": "STU-002", "status": "absent"}
  ]
}
```

Use revision `0` for a new register, then send its returned revision when editing. `409` means the register changed or its class/day scope conflicts; reload it before retrying. Partial saves preserve other existing marks. There is no implicit absent status and no delete-all-on-save behavior.

## Meaning of the calculations

Present and late count as attended. The percentage is `(present + late) / all recorded sessions × 100`, including absent and excused sessions in the denominator. No recorded sessions yields `null`, shown as a dash. Unmarked, future, unscheduled and holiday dates are not inferred absent. Period `0` is an explicit whole-day register and counts as one session. Whole-day and period registers cannot overlap for the same class/date.

Day is the selected date; week runs Monday–Sunday; month and year use calendar boundaries around that date. A day with any absent period counts as a **day with absences**, rather than necessarily a full-day absence. Leave days are distinct student/date pairs from approved student leave requests and explicitly marked excused attendance, deduplicated when both exist. In class summaries the counts are student-days; personal summaries refer to the selected student. Approved leave without a marked class session does not enter the attendance percentage. Charts and calendars distinguish leave, absence and not recorded.

## Access, persistence and compatibility

Staff require allocated attendance screen and student-attendance table permissions. Teachers are restricted to assigned offering sections, must choose an assigned section to save, and cannot include students outside that roster. Student/parent responses contain only self/linked-child marks, and cannot write. Saves reject future dates, dates outside the academic batch, duplicate students and invalid period/status values. Edits require edit permission and revisions prevent stale writes.

Registers persist under the `attendance_registers` workspace-document namespace. SQL backends store these versioned documents in existing `record_extras`; no new physical tables or migrations are required. Historical offering-based sessions and student marks remain visible. Historical periods are ranked by class/date/start time when no period number exists; editing one preserves untouched marks and replaces its matching legacy view to avoid double counting.

Deploy the backend with these routes before releasing the updated web/mobile clients. Existing legacy attendance routes remain available, but older clients do not read the new document-based registers. Rebuild both Flutter applications to use the new Attendance hubs.

## Validation

`python -m pytest tests/test_attendance_workspace.py` covers roster boundaries, percentages, leaves, period/day conflicts, historical data, optimistic edits, permissions and family isolation. Each Flutter app includes `test/attendance_workspace_test.dart` for teacher marking and student read-only calendar/overview flows.
