# Dashboard uploads: database tables and S3 folders

Audited against the current repository on 26 October 2026.

Bucket: `edu-admin-portal-file` · Region: `ap-south-1` · Root prefix: `Admin_Uploads/`.

## 1. Which dashboard upload fields use S3?

All persisted upload flows below call the backend, which uses S3 when `EDUNEXA_FILE_STORAGE=s3`.
The frontend never receives AWS access keys or writes directly to the bucket.

| Dashboard component | File inputs / purpose | API | S3 connected? |
| --- | --- | --- | --- |
| `StudentEnrollmentWizard.tsx` | Student photo, camera photo, Aadhaar copy, transfer certificate, study/conduct certificate, certificate copy, original certificate | `POST /api/v1/documents/upload`, `kind=student_document`, after creating the student | Yes |
| `StaffOnboardingForm.tsx` | Aadhaar, PAN, bank proof, qualification certificates, experience documents for teaching/non-teaching/labour staff | Same endpoint, `kind=employee_document`, after creating the employee | Yes |
| `PersonFiles.tsx` | Additional student/employee/application documents and profile photos from the Files button | Same endpoint, student/employee/admission kind | Yes |
| `ConnectedPortal.tsx` imports field | Original client XLSX workbook | Import validation API; backend saves workbook bytes and metadata | Yes |
| Certificate issue action | Generated certificate PDF; this is an action, not a file input | `POST /api/v1/documents/certificates/issue` | Yes |
| Tax-document API | Form 16 / Form 16A PDF | `POST /api/v1/documents/upload`, `kind=form_16` or `form_16a` | Yes; API support, not a separate newly added tax upload form |
| `ERPFormFields.tsx` legacy photo input | Older template student photo preview | In-memory image conversion; no upload request | No. The current `CollegePortal.form()` opens the connected workspace instead of opening this legacy form. |
| `OperationsUI.tsx` legacy file input, including `MobileAppsWorkspace.tsx` learning-material / submission attachments | Older demo attachment preview | FileReader data URL; no upload request | No. These controls are not S3 uploads. `CollegeStore.run` dispatches the connected management workspace rather than persisting these demo values. |
| `UploadBox.tsx` / `UploadButton` | Shared visual file picker | Uses its parent's `onChange` handler | The picker itself does not upload. Its parent determines storage. |

**Scope:** persisted administration uploads are connected. It would be inaccurate to say every
file picker anywhere in the source tree writes to S3: the legacy preview controls above do not.
Camera capture and image resizing use temporary browser data URLs before confirmation; this is
not evidence of a local-only final upload. Enrollment sends the selected photo to the backend
when the enrollment is confirmed. Selected WebP/other browser-decodable images are converted
to JPEG, and larger photos are resized/compressed to the upload limit before confirmation.
Unreadable images and failed camera captures show an error rather than silently retaining an
unuploadable photo.

## 2. Which database tables store the data?

File bytes live in S3. SQL stores references, metadata, ownership, relationships and audit events.
Base64 is the upload transport; the upload handlers do not save that base64 as the file in SQL.

| File or relationship | Main SQL table | Important fields / relation |
| --- | --- | --- |
| Every new uploaded/generated file | `file_storage_objects` | Central inventory; `document_table` + `document_code` identify the original record, and `owner_type` + `owner_code` identify its owner |
| Student documents and student photos | `documents` | `code`, `student_code`, `document_type`, `storage_key`, `original_filename`, `mime_type` |
| Staff documents and employee photos | `documents` | Same table; `employee_code` identifies staff instead of `student_code` |
| Application/admission documents | `admission_documents` | `application_code`, `document_type_code`, `storage_key`, filename, MIME, size, checksum, revision, `is_current`, verification status, uploader |
| Form 16 / Form 16A | `employee_tax_documents` | `employee_code`, `financial_year`, `document_type`, `revision`, `storage_key`, `sha256`, publisher and publication time |
| Generated certificate PDF | `certificates` | Certificate/request number, `storage_key`, `document_url`, issue details, verification token and revocation date |
| Certificate signature | `certificate_signatures` | `certificate_code`, `signed_document_storage_key`, `document_sha256`, algorithm, signer and signing time; additional signature/public-key details use record extras when no physical column exists |
| Original uploaded workbook | `import_jobs` | `filename`, `file_sha256`, import status/counts; file storage metadata is added to this record |
| Student profile image pointer | `students` | `profile_photo_storage_key`; `profile_photo_url` is persisted through record extras when there is no physical column |
| Employee profile image pointer | `employees` | `profile_photo_storage_key` and `profile_photo_url` through record extras when there are no physical columns |
| Student document checklist | `student_admission_profiles` | `document_checklist[label]` stores `document_code`, `uploaded=true`, `submitted=true` |
| Staff document checklist | `employee_profiles` | `document_checklist[label]` stores `document_code`, `uploaded=true` |
| Verified application documents linked during enrollment | `student_document_links` | `student_code` → `admission_document_code`; this creates a relationship, not another S3 copy |
| Fields without physical columns in the original table | `record_extras` | `table_name`, `record_code`, JSON `data`; the SQL adapters merge these fields back into the record when reading |
| Upload/download/deletion/issue actions | `audit_logs` through the store's audit mapping | Actor, action, resource, record code and timestamp; file bytes and credentials are excluded |

`teachers` and `staff_profiles` describe staff roles. Uploaded staff documents are owned by the
underlying **employee code**, rather than being duplicated into separate teacher upload tables.

### Central inventory columns

`file_storage_objects` has these physical columns:

| Columns | What they store |
| --- | --- |
| `code` | Same generated code as the original document/certificate/import record |
| `owner_type`, `owner_code` | `student`, `employee`, `application`, or `import`, and its code |
| `document_table`, `document_code` | Original table and record to which the file belongs |
| `storage_provider` | `s3` for the current configuration |
| `storage_key` | Relative key, normally without the `Admin_Uploads/` prefix |
| `s3_bucket` | `edu-admin-portal-file` |
| `s3_key` | Full object key, including `Admin_Uploads/` |
| `s3_uri` | `s3://edu-admin-portal-file/<full-object-key>` |
| `original_filename`, `mime_type`, `size_bytes` | User filename, detected/assigned content type, actual byte count |
| `sha256` | SHA-256 checksum of the saved bytes |
| `document_url` | Stable authenticated backend view path |
| `uploaded_at`, `uploaded_by_user_code` | Upload timestamp and account code |
| `deleted_at` | Null for active files; timestamp after deletion |

Original document tables have different physical columns. Extra fields such as `s3_uri`,
`document_url`, `size_bytes`, `sha256`, upload time and deletion time are stored in
`record_extras` wherever that original table lacks a matching physical column. The inventory
always gives a consistent set of physical columns to query.

## 3. How are S3 subfolders created?

The backend constructs a unique object key. Calling S3 `put_object` with that key creates the
object under those prefixes. No separate directory-creation request or empty folder object is
required. A folder normally becomes visible after its first successful upload; creating a
student/employee without uploading a file does not create an empty S3 folder.

```text
Admin_Uploads/
├── Students/<admission-number-or-student-code>/<student-code>/<document-label>/FILE-<uuid>.<ext>
├── Students/<admission-number-or-student-code>/<student-code>/Certificates/CERT-FILE-<uuid>.pdf
├── Applications/<application-number-or-code>/<application-code>/<document-label>/FILE-<uuid>.<ext>
├── Teaching_Staff/<employee-number-or-code>/<employee-code>/<document-label>/FILE-<uuid>.<ext>
├── Non_Teaching_Staff/<employee-number-or-code>/<employee-code>/<document-label>/FILE-<uuid>.<ext>
├── Labour/<employee-number-or-code>/<employee-code>/<document-label>/FILE-<uuid>.<ext>
├── Employees/<employee-number-or-code>/<employee-code>/<document-label>/FILE-<uuid>.<ext>
└── Imports/<import-job-code>/FILE-<uuid>.xlsx
```

Folder selection uses the employee's `employee_type`:

| `employees.employee_type` | S3 category |
| --- | --- |
| `teacher` | `Teaching_Staff` |
| `staff` | `Non_Teaching_Staff` |
| `labour` | `Labour` |
| Other/missing | `Employees` |

Document-label examples: `student_photo`, `aadhaar_copy`, `pan_copy`, `bank_proof`,
`transfer_certificate`, `study_conduct_certificate`, `certificate_copy`, `original_certificate`,
`certificate_<qualification-name>`, `experience_1`, `form_16`, `form_16a`.

If a label is not supplied, the upload kind becomes the folder name. Admission upload labels
are independent of their mandatory `document_type_code` database reference.

IDs are normalized into safe path segments. Slashes/spaces and other unsafe characters become
underscores. The readable part is limited to 60 characters. A short SHA-256 suffix is appended
when normalization/truncation changes an ID, which prevents collisions. The additional immutable
record code also prevents two people with the same human-readable number from sharing files.
Original filenames never determine the object key, and generated UUIDs prevent overwrites.
Extensions are selected from detected MIME type (`.pdf`, `.png`, `.jpg`); workbook/certificate
extensions are assigned by their dedicated handlers.

Files keep their original path if an admission number or employee identifier changes later.
Application documents stay in their application folder after enrollment; linking them to a
student does not move or duplicate them.

### Example: student photo

Illustrative values, not an actual uploaded student record:

```text
student_code:      S1
admission_number:  ADM1
document_label:    student_photo
original_filename: passport.jpg
storage_key:       Students/ADM1/S1/student_photo/FILE-<uuid>.jpg
s3_key:            Admin_Uploads/Students/ADM1/S1/student_photo/FILE-<uuid>.jpg
s3_uri:            s3://edu-admin-portal-file/Admin_Uploads/Students/ADM1/S1/student_photo/FILE-<uuid>.jpg
document_url:      /api/v1/documents/document/DOC-<uuid>/view
```

That upload creates a `documents` row and a `file_storage_objects` row, updates the student's
photo pointer and enrollment checklist if present, persists additional metadata in `record_extras`
where needed, and records an audit event. It does not create a new student row.

## 4. Save, display, and delete sequence

1. Enrollment/onboarding creates the student or employee first and returns its real code.
2. Each selected file is sent separately with that code, its label, filename and base64 content.
3. Backend checks the current account's permission, validates the owner, decodes the bytes,
   checks the size/type, calculates SHA-256 and constructs the object key.
4. Backend uploads bytes to private S3 with AES256 encryption, writes the original document row
   and inventory row, updates relevant photo/checklist pointers, then commits the SQL transaction.
5. On transaction failure, it attempts to remove the newly uploaded object. Failures are surfaced;
   an unsuccessful cleanup is logged for investigation.
6. The frontend displays/downloads through the authenticated Next.js proxy. Stored URLs are stable
   API paths, not public S3 URLs or expiring signed links. For example, backend
   `/api/v1/documents/document/<code>/view` is requested in the dashboard as
   `/api/college/documents/document/<code>/view` so the proxy can attach the user's session.
7. Delete checks permission, records deletion, clears matching photo/checklist pointers, commits
   that state, then deletes the S3 object. Metadata remains for audit. Failed S3 deletion can be
   retried. Generated certificates use revocation instead of this delete operation.

Enrollment/onboarding and file uploads are separate transactions. If a file upload fails after
the person is created, the UI reports the failed files and the Files control can retry them.
Merely selecting a file is not a successful upload. PDF/PNG/JPEG document uploads retain the
650,000-byte server limit; the photo controls can resize images before uploading. XLSX imports
use their dedicated validation endpoint and limits.

## 5. SQL examples (SQL Server)

List active uploaded files for a real student code:

```sql
SELECT code, document_table, document_code, original_filename, mime_type,
       size_bytes, s3_bucket, s3_key, s3_uri, document_url, uploaded_at
FROM dbo.file_storage_objects
WHERE owner_type = 'student'
  AND owner_code = 'S1'
  AND deleted_at IS NULL
ORDER BY uploaded_at DESC;
```

Find staff files (teaching/non-teaching/labour all use employee ownership):

```sql
SELECT owner_code, original_filename, s3_uri, document_url
FROM dbo.file_storage_objects
WHERE owner_type = 'employee' AND deleted_at IS NULL;
```

Join student documents to the central inventory:

```sql
SELECT d.code, d.student_code, d.document_type, d.original_filename,
       f.s3_uri, f.document_url, f.size_bytes, f.sha256
FROM dbo.documents AS d
JOIN dbo.file_storage_objects AS f
  ON f.document_table = 'documents' AND f.document_code = d.code
WHERE d.student_code = 'S1' AND f.deleted_at IS NULL;
```

Inspect photo URLs in extras when they do not have physical columns:

```sql
SELECT table_name, record_code,
       JSON_VALUE(data, '$.profile_photo_url') AS profile_photo_url
FROM dbo.record_extras
WHERE table_name IN ('students', 'employees')
  AND JSON_VALUE(data, '$.profile_photo_url') IS NOT NULL;
```

The first three queries also work on PostgreSQL after removing `dbo.`. PostgreSQL extras use
`data->>'profile_photo_url'` instead of `JSON_VALUE`. Substitute your configured schema if it is
not `dbo`/`public`. Older files are not automatically backfilled into this new inventory.

## 6. Implementation and verification references

- `admin-dashboard/src/components/colleges/enrollment/StudentEnrollmentWizard.tsx`
- `admin-dashboard/src/components/colleges/staff/StaffOnboardingForm.tsx`
- `admin-dashboard/src/components/colleges/PersonFiles.tsx`
- `admin-dashboard/src/services/api/modules/documents/service.ts`
- `backend/app/modules/documents/files/api.py`: owner folders, uploads, certificates, views/deletion.
- `backend/app/modules/imports/excel/api.py`: workbook storage.
- `backend/app/core/files.py`: S3 prefix, upload/read/delete operations.
- `backend/app/core/sql_store.py` and `sqlserver.py`: SQL records and `record_extras` persistence.
- `database/sqlserver/012_file_storage_objects.sql`: SQL Server inventory DDL.
- `database/file_storage_objects_postgresql.sql`: PostgreSQL inventory DDL.
- `backend/tests/test_s3_files.py`: folder separation, metadata, private access, deletion, rollback.
- `backend/tools/check_s3_storage.py`: live temporary-object upload/read/delete verification.

The earlier live S3 health check succeeded and removed its test object. This confirms actual
bucket read/write/delete access, not an end-to-end dashboard-browser upload test. The backend
suite passed 88 tests with one skipped, and dashboard TypeScript/ESLint checks passed at the end
of the implementation. Restart/deploy the changed services to apply the code to running hosts.

For configuration and IAM policy details, see [S3_STORAGE.md](S3_STORAGE.md). No credentials are
included in this reference.
