# Student enrollment register and drawers

The Student enrollment register displays only Student name, Admission number, University
registration number, Course, Batch year, and Actions. Course/batch labels are joined on the
backend from admission profiles, with section/batch enrollment as a fallback for older records.

Edit opens the existing right-side form. Previous education is shown as eight individual fields:
qualification level, institution, board/university, group/stream, passing year, grade/percentage,
first-year score, and second-year score. The frontend packs them into the original JSON field
when saving; no JSON editor is presented for education. Existing unknown education attributes
are retained. The backend synchronizes the admission-profile qualification and student summary
fields and preserves photo URL metadata during edits.

Info opens a wider right-side drawer with identity, contact, admission, course/batch, guardian,
previous education, and the enrollment/fee summary. Documents appear in the same drawer and in
a dedicated Documents & files tab. Verified application documents linked to a student are also
included in the file list.

View expands the current Files drawer from 980px to 1240px where the viewport permits. It shows
the selected file beside the file list, inside the same drawer. The compact image/PDF viewport
is 340px tall (at most 40% of viewport height), with internal scrolling, zoom and downloads.
No second drawer or new browser tab is opened for previews. On narrow screens the list and
preview stack vertically, and the drawer occupies the viewport width.

Each data-column header contains a filter icon. Its popup provides search, selectable values,
Select all/none, Apply and Clear. Values within a column are ORed; active columns are ANDed.
Filtering happens on the backend before pagination. The endpoint also returns all permitted
register values in `filter_options`, so users can select courses/batches outside the current page.
The existing search and export actions respect the current filter selection; exports contain
the visible page. The Actions column has no filter because it contains controls, not student data.

The student list API accepts a JSON-encoded `column_filters` query value, for example:

```json
{"course_name":["Intermediate MPC","Intermediate BPC"],"batch_year":["2026–2028"]}
```

Allowed keys: `student_name`, `admission_number`, `university_registration_number`, `course_name`,
`batch_year`. Omitting a key means all values; an empty selection list means no matching values.
Single-column legacy contains queries and `search` remain supported. HTTP permissions apply to
the list and document APIs. Existing uploaded bytes remain private and are retrieved through
the authenticated frontend proxy.
