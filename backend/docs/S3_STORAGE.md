# Private S3 files

For the field-by-field audit, table/column mapping, folder examples, and SQL queries, see
[Upload database and S3 map](UPLOAD_DATABASE_AND_S3_MAP.md).

Uploads use `s3://edu-admin-portal-file/Admin_Uploads/` in `ap-south-1`. Credentials live only
in the ignored `backend/.env` or hosting secrets. Rotate the key shared in chat and replace
`EDUNEXA_S3_ACCESS_KEY` and `EDUNEXA_S3_SECRET_KEY`. IAM roles work when both are omitted.

## Setup and deployment

```dotenv
EDUNEXA_FILE_STORAGE=s3
EDUNEXA_S3_BUCKET_NAME=edu-admin-portal-file
EDUNEXA_S3_PREFIX=Admin_Uploads
EDUNEXA_S3_REGION=ap-south-1
```

From `backend/` after installing requirements:

```sh
.venv/bin/python tools/setup_s3_metadata.py
.venv/bin/python tools/check_s3_storage.py
```

Setup adds `file_storage_objects` and its owner index to SQL Server/PostgreSQL without changing
existing documents. It is safe to rerun. Restart the backend afterward to refresh cached schema
metadata. Fresh PostgreSQL installs include this table. Apply the same environment values to
hosted backend secrets and deploy/restart both services for remote users to see these changes.
The health check writes, reads and deletes one temporary object under `Admin_Uploads/Healthchecks/`.

`tools/s3-upload-policy.json` is the scoped IAM policy for the backend principal if permissions
are missing. The application does not modify IAM or bucket policies. Keep the bucket private.
Objects use AES256 encryption and unique keys. Browser requests use the authenticated backend;
no S3 CORS configuration is required.

## Folders

```text
Admin_Uploads/
  Students/<admission-number>/<student-code>/<label>/<unique-file>.jpg
  Applications/<application-number>/<application-code>/<label>/<unique-file>.pdf
  Teaching_Staff/<employee-number-or-code>/<employee-code>/<label>/<unique-file>.pdf
  Non_Teaching_Staff/<employee-number-or-code>/<employee-code>/<label>/<unique-file>.pdf
  Labour/<employee-number-or-code>/<employee-code>/<label>/<unique-file>.pdf
  Employees/<employee-number-or-code>/<employee-code>/<label>/<unique-file>.pdf
  Students/<admission-number>/<student-code>/Certificates/<unique-file>.pdf
  Imports/<job-code>/<unique-file>.xlsx
```

Immutable record codes prevent collisions. IDs with slashes/spaces are normalized with a hash.
Original filenames are metadata, never object paths. Files retain their folder when identifiers
change; admission uploads retain their application folder after enrollment.

## Database and API

The original tables keep document relationships and use the existing `record_extras` persistence
for additional metadata and profile URLs. `file_storage_objects` provides a directly queryable
inventory with owner, document table/code, provider/key, S3 bucket/key/URI, original filename,
MIME type, size, SHA256, stable view URL, uploader/time and deletion time.

```sql
SELECT owner_type, owner_code, original_filename, mime_type, size_bytes,
       s3_uri, document_url, uploaded_at
FROM file_storage_objects
WHERE owner_type = 'student' AND owner_code = 'STUDENT-CODE' AND deleted_at IS NULL;
```

- `POST /api/v1/documents/upload`: student, employee, tax and admission uploads.
- `GET /api/v1/documents/files/{student|employee|application}/{code}`: owner file list.
- `GET /api/v1/documents/{kind}/{code}/view`: authenticated inline display.
- `GET /api/v1/documents/{kind}/{code}/download`: download with the original filename.
- `DELETE /api/v1/documents/{kind}/{code}/file`: permission-checked object deletion.

Kinds: `document`, `tax-document`, `admission-document`, `certificate`, `import-workbook`.
Certificates are retained and use the existing revoke workflow. Deletion retains audit metadata,
clears photo/checklist links and denies reads before deleting bytes. Failed object deletions can
be retried with the same DELETE endpoint. S3 versioning/lifecycle policies govern older versions.

The DB stores stable authenticated view paths, not public PII links or expiring presigned URLs.
The dashboard's `/api/college/` proxy preserves the httpOnly session. Profile images also set
`profile_photo_url` and `profile_photo_storage_key` on the student/employee. Profile labels are
`student_photo`, `employee_photo`, `staff_photo` and `profile_photo`.

Use Files on student/application/staff records to upload, preview, view, download and delete.
Enrollment and staff onboarding upload fields already use the shared API. Import jobs retain
original XLSX workbooks. PDF/JPEG/PNG uploads retain the existing 650,000-byte limit and signature
checks, matching the proxy's 1 MB JSON limit. The separate offline/demo portal retains local
example data; persisted administration uses the connected dashboard.

## Older files

This change does not move or delete old objects. Records with a local/Supabase provider continue
using it while the original files/credentials remain available. Legacy records without a provider
can still read an existing local file under `EDUNEXA_DATA_DIR/files` on that backend host.
Legacy Supabase-only records need a provider backfill/migration before switching their deployment
to S3; retain that deployment's original configuration until migrated.

## Optional S3 CORS configuration

The confirmed deployed frontend is `https://eduportal-beige.vercel.app`.

- **AWS console:** open bucket `edu-admin-portal-file` → Permissions → Cross-origin resource
  sharing (CORS) → Edit. Paste the complete JSON array from [`tools/s3-cors.json`](../tools/s3-cors.json)
  and save. This is a bucket-level configuration, including the `Admin_Uploads/` prefix.
- **AWS CLI:** use [`tools/s3-cors-cli.json`](../tools/s3-cors-cli.json), which wraps the same rules
  in `CORSRules`. From `backend/`, with AWS credentials configured:

```sh
aws s3api put-bucket-cors --bucket edu-admin-portal-file --region ap-south-1 --cors-configuration file://tools/s3-cors-cli.json
aws s3api get-bucket-cors --bucket edu-admin-portal-file --region ap-south-1
```

Both files include the deployed frontend, localhost/127.0.0.1 frontend ports 3000, 3010 and 3012,
the configured backend origin `http://185.193.19.156:8010`, and local backend port 8010.
Origins contain a scheme, host and port where applicable, without paths or trailing slashes.
GET, HEAD, PUT, POST and DELETE are included; S3 handles preflight OPTIONS automatically.
The two formats follow the [AWS S3 CORS documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).

Creating these files does not apply the policy to AWS. Applying a CORS configuration replaces
the bucket's existing CORS rules, so retain any rules for other applications using this bucket.
CORS does not grant object access or make the bucket public. Existing dashboard uploads pass
through the backend and do not require S3 CORS; these rules support browser-to-S3 requests when
using an authorized S3 URL. Backend API CORS remains a separate `EDUNEXA_CORS_ORIGINS` setting.
