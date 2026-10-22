# Initial data collection, version 2

13 separate professional Excel files. Use CLIENT_README.txt for distribution. Styling is white, charcoal and neutral grey, with required-field asterisks rather than colored mandatory columns. Each file contains only its own related data tabs and a Guide. There are 24 data tabs across the entire set and 439 field definitions, not one combined 41-tab input workbook.

- `01_Students_and_Parents.xlsx`: Admissions, student profiles and family contacts.
- `02_Courses_and_Subjects.xlsx`: Available courses, curriculum structure and subject requirements.
- `03_Employees.xlsx`: Common employment details for every teacher and non-teaching staff member.
- `04_Teachers.xlsx`: Academic appointments and teaching responsibilities.
- `05_Staff.xlsx`: Administrative, support and operational responsibilities.
- `06_Student_Enrollments.xlsx`: Course, batch, semester, section and roll-number placement.
- `07_Fee_Heads.xlsx`: Approved fee categories and accounting classification.
- `08_Fee_Structures_and_Scholarships.xlsx`: Course-wise standard rates before scholarships, scheme rules and approved awards.
- `09_Student_Charges_and_Payments.xlsx`: Itemized academic, tuition, bus, hostel and other dues, scholarships and received payments.
- `10_Bus_Transport.xlsx`: Routes, stop-wise bus charges and student transport allocation.
- `11_Hostel_Rooms_and_Allocations.xlsx`: Accommodation inventory, room charges and student bed allocation.
- `12_Leave_Types.xlsx`: Approved leave types, eligibility and entitlement rules.
- `13_College_Calendar_and_Events.xlsx`: Academic dates, holidays, examinations, activities and meetings.

## Developer import requirements

`import-contract-v2.json` is authoritative for this set: file name, tab name, row 6 headers, first input row 7, field keys, labels, types, required flags, examples, relationships and business validation rules. This version is intentionally different from the archived v1 row-1-header workbook.

The future Python importer must accept the separate files as a reviewed batch or resolve dependencies against previously committed master records. Skip Guide and all calculated columns. Recompute finance results on the server. All inputs are blank, with fictional examples only in Guide.

**Schema alignment:** these expanded collection fields exceed the original 94-table SQL baseline. Target table names are planning hints, not a completed column map. Implement reviewed staging, explicit source-to-target projections, enum translations and additive schema migrations before production import. Do not discard extra fields. For example, Course code resolves to programs.code, Employee code resolves to employees.code, address components require assembly or additional columns, and enrollment details resolve into batches, semesters, sections and enrollment rows. Fee installments, scholarship policies, leave rules and event metadata need expanded persistence. No SQL schema changes or backend implementation were made in this revision.

Validate identifiers, parent links, categories, cross-file references, date ranges, scholarship eligibility and award caps, payment allocations, room/bed overlaps and route capacity. See validation_rules in the v2 contract. Do not infer production authorization from uploaded campus codes. Defaults must not silently create or overwrite masters during a routine update.

## Verification

All 13 exports were reopened to check field headers, truly blank input cells, text identifiers, date formats, dropdowns, grey calculations, neutral table styles and frozen header/identifier panes. Every data-tab header block and each Guide were rendered and visually reviewed. Finance recalculation was exercised for settled versus pending payment, missing references, zero and blank amounts. Native Microsoft Excel recalculation was not run. backend/ remains completely empty.
