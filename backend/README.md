# EduNexa College Python backend

## Running on Windows Server

Use the updated backend source and install `requirements.txt` in the server’s active virtual environment. Local development file locking uses `filelock`, which supports Windows; the server no longer imports Unix-only `fcntl` directly. The SQL Server backend continues to use database transactions and application locks.

From `C:\edu portal\backend` with the virtual environment activated:

```bat
python -m pip install -r requirements.txt
python -m uvicorn app.asgi:app --host 0.0.0.0 --port 8010
```

In a second terminal, check `curl.exe http://127.0.0.1:8010/health`. The configured SQL Server runtime should report `"storage":"sqlserver"`. Then check `curl.exe http://127.0.0.1:8010/api/v1/auth/roles` for the migrated roles.

## Current SQL Server configuration

### Automatic startup on the Windows database server

The repository includes a [WinSW service configuration](deploy/windows/EduNexaBackend.xml)
and [one-command setup](deploy/windows/setup.ps1). The service runs as LocalService,
starts automatically after boot, restarts after process failure, and keeps running
when Remote Desktop disconnects. These files are prepared locally; they have not
been installed or tested on the Windows server.

1. Install **64-bit Python 3.12 for all users** on Windows so LocalService can access
   the base Python installation. Copy the backend to `C:\edu portal\backend`.
   Exclude the Mac `.venv`, `.migration-target`, caches, and development recordings.
   The setup script creates a fresh Windows `.venv` and installs dependencies.
   On a fresh server, open **PowerShell as Administrator** and install the
   official Python 3.12.10 x64 installer (the final traditional Windows installer
   in the 3.12 series):

   ```powershell
   $ErrorActionPreference = 'Stop'
   [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
   $pythonInstaller = Join-Path $env:TEMP 'python-3.12.10-amd64.exe'
   Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile $pythonInstaller
   $pythonInstall = Start-Process -FilePath $pythonInstaller -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1 Include_launcher=1 InstallLauncherAllUsers=1 Include_pip=1 Include_test=0' -Wait -PassThru
   if ($pythonInstall.ExitCode -notin @(0, 3010)) { throw "Python install failed: $($pythonInstall.ExitCode)" }
   if ($pythonInstall.ExitCode -eq 3010) { Write-Host 'Windows requests a reboot before continuing.' }
   ```

   Close and reopen PowerShell as Administrator after installation (reboot first
   if requested), then verify `py -3.12 --version`. Installation flags follow
   [Python's Windows documentation](https://docs.python.org/3.12/using/windows.html#installing-without-ui).
   Use quotes around the backend path because `edu portal` contains a space.

2. Place the production `.env` in that backend folder. Retain the existing JWT and
   certificate signing keys and file-storage credentials/settings so tokens, signed
   documents, and uploaded files continue to work. Copy any local files referenced
   by those settings, including `var` if it contains uploads or signing keys.
   Change these database settings for the migrated database on the same machine:

   ```dotenv
   EDUNEXA_STORAGE_BACKEND=sqlserver
   EDUNEXA_MSSQL_HOST=127.0.0.1
   EDUNEXA_MSSQL_PORT=1433
   EDUNEXA_MSSQL_NAME='Edu Admin'
   EDUNEXA_MSSQL_USER=YOUR_NEW_SERVER_SQL_LOGIN
   EDUNEXA_MSSQL_PASSWORD='YOUR_NEW_SERVER_SQL_PASSWORD'
   EDUNEXA_MSSQL_ENCRYPTION=require
   ```

   Use a SQL login that has access to `Edu Admin`; source-server SQL logins are not
   transferred by the database data copy. Keep the existing storage settings; this
   service setup does not move objects between S3, Supabase, or local storage.
   Set `EDUNEXA_PUBLIC_API_URL`, `EDUNEXA_PUBLIC_PORTAL_URL`, and
   `EDUNEXA_CORS_ORIGINS` to your deployment URLs. CORS origins use a JSON array.
   The service defaults to the backend's `var` folder for runtime files. If you use
   a different `EDUNEXA_DATA_DIR`, grant LocalService write access there too.

3. In **PowerShell as Administrator**, run (adjust the path if you placed the
   backend elsewhere; the scripts locate the backend relative to themselves):

   ```powershell
   cd "C:\edu portal\backend"
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\setup.ps1
   ```

   Setup creates `.venv`, installs `requirements.txt`, validates production
   settings and SQL database access, downloads **WinSW-x64.exe** from the official
   [WinSW 2.12.0 release](https://github.com/winsw/winsw/releases/tag/v2.12.0),
   then installs and starts the service. Internet access is needed for dependencies
   and WinSW. An existing compatible Windows `.venv` is reused; a copied Mac
   `.venv` is rejected. Setup does not overwrite `.env` or change database data.
   If a service is already installed, setup stops with an instruction instead of
   changing the running service.

   Then open `services.msc` and find **EduNexa Backend**. Manage it using:

   ```powershell
   Get-Service EduNexaBackend
   Restart-Service EduNexaBackend
   Stop-Service EduNexaBackend
   Start-Service EduNexaBackend
   curl.exe http://127.0.0.1:8010/health
   curl.exe http://127.0.0.1:8010/api/v1/auth/roles
   ```

   `/health` reports configuration and HTTP availability; the roles endpoint also
   tests database access. To follow startup/error logs live:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\logs.ps1
   ```

   For HTTP request logs, use `logs.ps1 -Stream out`; for service wrapper problems,
   use `logs.ps1 -Stream wrapper`. Press **Ctrl+C** to stop watching without stopping
   the backend. Rerun the viewer if the service restarts or a log rotates.
   Logs are also plain text files you can open in Notepad:

   - `deploy\windows\logs\EduNexaBackend.err.log`: startup messages and errors.
   - `deploy\windows\logs\EduNexaBackend.out.log`: HTTP access/output messages.
   - `deploy\windows\logs\EduNexaBackend.wrapper.log`: service wrapper diagnostics.

   Application logs rotate at 10 MiB, keeping up to eight rotated files per stream.
   For application
   updates, stop the service, replace source/install dependencies, and start it.
   For example, after copying updated source (keep `.env`, `var`, and service files):

   ```powershell
   Stop-Service EduNexaBackend
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   Start-Service EduNexaBackend
   ```

   To uninstall, stop it and run `.\deploy\windows\EduNexaBackend.exe uninstall`.

4. For public access, put an HTTPS reverse proxy (for example IIS with ARR/URL
   Rewrite) in front of `http://127.0.0.1:8010`. The supplied service listens only
   locally. Allow the proxy's HTTPS port **443** through Windows Firewall and Utho,
   configure DNS and its TLS certificate, and point the dashboard/mobile API URL
   to that HTTPS address. SQL port **1433** serves database clients; it does not
   serve the backend HTTP API. Verify sign-in and file access before switching
   users over from the original backend.

See the [WinSW configuration documentation](https://github.com/winsw/winsw/blob/v2.12.0/doc/xmlConfigFile.md)
for service startup, account, and recovery options.

The runtime `.env` now selects `EDUNEXA_STORAGE_BACKEND=sqlserver` and uses `EDUNEXA_MSSQL_*` settings for the `edu-admin-portal` database on `185.193.19.156:1433`, with encrypted SQL Server authentication. No PostgreSQL connection settings remain in the runtime `.env`.

Install dependencies with `pip install -r requirements.txt` (or `uv sync --locked`) and restart the backend after deploying these changes. `/health` should report `storage: sqlserver`; `/api/v1/public/options` should contain the 130 migrated courses. A local `.env` is excluded from Vercel uploads, so Vercel deployments must receive the same SQL Server settings through hosting environment variables. Keep the existing JWT secret stable.

The PostgreSQL-to-SQL Server transfer is implemented in `tools/transfer_to_sqlserver.py`. It defaults to a rollback rehearsal; `--merge-login postgres --apply` commits an explicitly requested account merge and the data copy. The applied schema additions are recorded in `../database/sqlserver/011_postgres_alignment.sql`. The transfer preserves unrelated target records, remaps stable account/link references, keeps the PostgreSQL password hash for the single `Pragathi` account, verifies copied fields, and preserves SQL Server’s own migration ledger. PostgreSQL migration history is archived with the encrypted source backup rather than copied into a different engine’s ledger.

Encrypted pre-transfer backups, their separate local encryption key, migration reports, and the archived PostgreSQL connection settings are under the ignored `.migration-target/` directory. `.vercelignore` and Vercel function exclusions prevent those files from being deployed. Keep the backups and key together in private storage until cutover and rollback needs have ended.

Run `pytest` for local backend tests. `EDUNEXA_TEST_SQLSERVER=1 pytest tests/test_sqlserver_integration.py` additionally checks login, course creation/listing, token refresh, and logout against a temporary SQL Server schema that it removes afterward.


FastAPI backend for the admin portal and Admin, Teacher, Parent and Student mobile clients. All source files are in this `backend/` folder.

## Run locally

Python 3.12 or later (validated using Python 3.14).

```bash
cd "/Users/sconex.ios.dev/Leads porjects/edunexa-college/backend"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
# python tools/setup_local.py
# python tools/bootstrap_admin.py
uvicorn app.asgi:app --host 127.0.0.1 --port 8010
```

`setup_local.py` generates a private random signing secret in an ignored `.env` file without overwriting existing configuration. Bootstrap asks for an individual administrator login and password; there is no default password. Open **http://127.0.0.1:8010/docs** for interactive API documentation and **/openapi.json** for the machine-readable contract. Log in using `/api/v1/auth/login`, then use Swagger's Authorize control with the returned access token.

```bash
python -m pytest -q
```

## Implemented

- Separate module/screen folders for 118 business resource screens, based on the existing 126-resource project catalog. Security tables use dedicated authentication/role APIs instead of generic table access.
- Each screen's `api.py` contains its routes **and the actual data-access query functions**. There are no separate `queries.sql` files. `schemas.py` defines typed request contracts; `service.py` applies common business rules. Dedicated transaction workflows keep their queries and endpoints together as well.
- Individual employee/student/parent accounts; Argon2 password hashes; signed 10-minute JWT access tokens; opaque rotating refresh tokens, hashed at rest; session/client binding; logout, logout-all and password-change revocation; refresh-reuse detection; failed-login throttling.
- Role creation/edit/deletion, screen/action permissions, account assignment, assigned-employee visibility, client allowlists, and account disabling. Protected administrator account/role prevents accidental lockout. Account/role administration remains reserved for that administrator.
- Form definitions with sections, field ordering, labels, required flags, input types and select choices; publish/unpublish, revisions, validation, historical submissions and audit. These are standalone backend definitions/submissions, not automatic changes to the existing web or Flutter screens or business schema.
- Record validation, reference checks, pagination, audit events, document metadata, student/parent/employee/course/subject/hostel/transport/library/inventory/calendar and other catalog resources.
- Atomic admission enrollment with guardian creation/linking, document checks, section capacity and roll-number validation, student creation and document transfer links. Invalid enrollment rolls back the complete operation.
- Fee ledger, discounts/waivers, scholarship approval/allocation, manual fee collection, receipts, duplicate-payment protection using idempotency keys, outstanding balances, collection ownership summaries and CSV export. Amounts use decimal arithmetic and the transaction workflows support INR.
- Hostel pickup approval, departure and return tracking.
- Identity-scoped mobile profile/student/fee/attendance queries; teacher published-payslip breakdown and tax-document metadata; admin finance overview. Student/parent endpoints reject access to unrelated students.

## Storage and integration status

**PostgreSQL (Supabase) is the persistence layer** when `EDUNEXA_STORAGE_BACKEND=postgres` (connection: `EDUNEXA_DB_*` in the ignored `.env`; see `.env.example`). Connections use TLS (`EDUNEXA_DB_SSLMODE=require`) and set `search_path` to `EDUNEXA_DB_SCHEMA` (default `public`). The direct Supabase host `db.<project>.supabase.co` is IPv6-only; on an IPv4-only server use the session pooler instead (`aws-0-<region>.pooler.supabase.com`, user `postgres.<project-ref>`). `local-json` (`var/development.json`) remains for offline development and the default test run.

**Where the SQL lives.** Each of the 133 screen modules (`app/modules/<module>/<screen>/api.py`) holds its own PostgreSQL statements as constants: `LIST_SQL`, `GET_SQL`, `INSERT_SQL`, `UPDATE_SQL`, `DELETE_SQL` and `REFERENCED_BY_SQL` (the in-use check before a delete). Its `query_list`/`query_get`/`query_save`/`query_delete` functions run them through `app/core/sql_queries.py`, which binds values as parameters, converts types, and keeps custom fields (`record_extras`) with the record. The statements are written from the live table definitions by `tools/generate_module_sql.py`; run it again after a migration (`--check` lists files that would change). Set `EDUNEXA_DB_LOG_SQL=1` to print every executed statement.

The 13 workflow modules (authentication, roles, forms, workspace, admissions enrollment and intake, documents, finance transactions, hostel permissions, imports, mobile, operations workflows, reports) change several tables per action. They work through `app/core/sql_store.py`, which implements the same `transaction()`/`snapshot()` interface as the JSON store:

- `data["records"][table]` is a lazy mapping keyed by `code`: `get`/`in`/`[]` run `SELECT ... WHERE code = %s`, iteration loads the table. Records keep JSON-style values (decimals and dates as strings).
- On commit, every loaded row is compared with what was read; differences are written with parameterized INSERT/UPDATE/DELETE in foreign-key order, batched, in one SQL transaction. A transaction-scoped advisory lock keeps one writer at a time (as the JSON file lock did); snapshots read without it.
- `accounts`, `roles`, `sessions`, `forms`, `submissions`, `audit` and `login_attempts` map to `users`/`user_roles`, `roles`/`role_permissions`/`permissions`, `refresh_tokens`, `form_definitions`, `form_submissions`, `audit_logs` and `login_attempts`. Fields without a column are kept in `record_extras`.
- Database rule violations (CHECK, foreign key, unique, trigger `RAISE EXCEPTION`) return HTTP 409 with the rule's message, and the whole request is rolled back.

Schema files: `../database/` holds two files. `edunexa_schema_postgresql.sql` is the complete schema the backend uses (versions 001–006, installed by `tools/apply_schema.py`). `edunexa_schema_mysql.sql` is the same schema for MySQL 8 (see its header for the differences). For a change to an existing database, add `../database/migrations/NNN_name.sql`, apply it with `tools/migrate.py`, then fold it into both schema files. Version 006 enables row level security on every table (no policies) and makes views `security_invoker`, so Supabase's public Data API (anon/authenticated keys) sees no EduNexa data; the backend connects as the table owner. New tables must enable RLS too.

```bash
python tools/db_check.py                 # connect and count tables/views/triggers
python tools/apply_schema.py --dry-run   # fresh database: apply in a transaction, then roll back
python tools/apply_schema.py             # fresh database only; records schema_migrations
python tools/migrate.py                  # existing database: apply pending migrations in order
EDUNEXA_TEST_STORAGE=postgres python -m pytest -q   # run the suite against a private test schema
```

The SQL test run installs the schema into its own `edunexa_test_<pid>` schema, empties it before each test and drops it afterwards; the live `public` tables are never touched. Against a distant Supabase region this run is slow (every statement is a network round trip). Fixture records written directly by test code are completed with placeholder values for required columns (`tests/sql_support.py`); records written by the application are not, so they must satisfy the real schema.

The admin dashboard and the four Flutter apps call these APIs; the dashboard's former in-browser demo store and seed data were removed. See [authentication integration](docs/AUTHENTICATION.md).

SMS delivery, online payment processing, authorized digital signing and document binary storage are **not configured**. Their integration routes return HTTP 503 rather than simulating success. Certificate issuance/download verification, real Form 16 generation, downloadable payslip files, statutory payroll calculations, Excel file parsing/import orchestration, full audit-ready cash-book payments and reconciliation remain integration/workflow work. The current cash-book endpoint explicitly reports cash receipts only; expenses do not yet have a payment-mode field. Financial records managed by a workflow cannot be edited through generic CRUD. Salary and certificate resources are readable contracts; they are not fabricated by a generic POST.

Deploy only behind HTTPS with approved persistent storage, verified authorization boundaries and configured integrations. No claim of production readiness or auditor certification is made by the development reports.

## Master data entry

`app/modules/master_data/onboarding/api.py` (`/api/v1/master-data/...`) covers the client data workbooks 01–06. Each call writes all related rows in one transaction through the tables' own services (validation, references, module SQL, audit):

| Screen | API |
|---|---|
| Student enrollment | `POST /master-data/students` (student, optional parents) |
| Parent enrollment | `POST` / `GET /master-data/students/{student_code}/parents` |
| Admission forms & certificates | `POST /master-data/admission-forms` (application, guardians, qualifications); certificates via `POST /documents/upload` |
| Teaching staff onboarding | `POST /master-data/staff/teaching` (employee + teacher profile), `GET /master-data/staff?kind=teaching` |
| Non-teaching staff onboarding | `POST /master-data/staff/non-teaching` (employee + staff profile + salary/pay components), `GET /master-data/staff?kind=non-teaching` |
| Courses & year-based batches | `POST /master-data/courses`, `POST /master-data/courses/{program_code}/batches`, `GET /master-data/courses/{program_code}` |
| Course enrollment | `POST /master-data/course-enrollments` |

`GET /master-data/actions` describes the same operations as dashboard forms. The **Master Data Entry** role (code `MASTER-DATA-ENTRY`) grants exactly these screens plus Excel imports of workbooks 01–06; roles may carry `screens` and `import_files` allowlists (`app/core/security.py: role_limit`). Create or update it, optionally with a login, with:

```bash
python tools/create_master_data_role.py --login <login-id>   # password prompted or EDUNEXA_NEW_PASSWORD
```

## API reference

`docs/API_REFERENCE.txt` lists every endpoint by module and by dashboard screen with method, URL, permission, sample payload and sample response (real pairs recorded from the test suite where available). Regenerate after API changes: `python tools/generate_api_reference.py`.

## Guides

- [Complete folder and file structure](docs/FOLDER_STRUCTURE.md)
- [API endpoint inventory](docs/API_ENDPOINTS.md)
- [Token authentication and app integration](docs/AUTHENTICATION.md)
- [Module and workflow guide](docs/MODULES_AND_WORKFLOWS.md)
- [Verification results](docs/VALIDATION.md)

## Deploying to Vercel

The backend deploys as one Python function (`api/index.py` serves the FastAPI app for every path;
see `vercel.json`). It runs in Sydney (`syd1`), next to the Supabase database, and keeps nothing
on local disk: data in PostgreSQL, files in a private Supabase Storage bucket, the certificate
signing key in an environment variable. It refuses to start on Vercel without them.

1. **File storage.** In Supabase, copy the project URL and the `service_role` key (Project
   Settings → API). Put them in `backend/.env` as `EDUNEXA_SUPABASE_URL` and
   `EDUNEXA_SUPABASE_SERVICE_ROLE_KEY`, then run `python tools/setup_file_storage.py` once to create
   the private bucket `edunexa-private`.
2. **Signing key.** Run `python tools/generate_signing_key.py` once and keep the value; it signs
   every certificate and must not change later.
3. **Vercel project.** Import the repository, set **Root Directory** to `backend` (the framework
   preset comes from `vercel.json`), add the environment variables below, and deploy. With the CLI:
   `cd backend && vercel deploy --prod`.
4. **Dashboard.** In the admin dashboard's deployment set `EDUNEXA_API_URL` to the backend URL
   (e.g. `https://edunexa-backend.vercel.app`); the dashboard's proxy calls it server to server.
5. **Check.** `https://<backend>.vercel.app/health` returns `{"status": "ok", "storage": "postgres"}`.

| Variable | Value |
| --- | --- |
| `EDUNEXA_JWT_SECRET` | a new random secret, 64+ characters |
| `EDUNEXA_STORAGE_BACKEND` | `postgres` |
| `EDUNEXA_DB_HOST` | `aws-0-ap-southeast-2.pooler.supabase.com` (transaction pooler; Vercel has no IPv6) |
| `EDUNEXA_DB_PORT` | `6543` |
| `EDUNEXA_DB_NAME` | `postgres` |
| `EDUNEXA_DB_USER` | `postgres.<project-ref>` |
| `EDUNEXA_DB_PASSWORD` | the database password |
| `EDUNEXA_DB_SSLMODE` | `require` |
| `EDUNEXA_FILE_STORAGE` | `supabase` |
| `EDUNEXA_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EDUNEXA_SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (secret) |
| `EDUNEXA_SUPABASE_BUCKET` | `edunexa-private` |
| `EDUNEXA_CERTIFICATE_SIGNING_KEY` | output of `tools/generate_signing_key.py` (secret) |
| `EDUNEXA_CORS_ORIGINS` | `["https://<dashboard>.vercel.app"]` |
| `EDUNEXA_PUBLIC_API_URL` / `EDUNEXA_PUBLIC_PORTAL_URL` | the backend and dashboard URLs |

Limits to know: request and response bodies are capped at 4.5 MB by Vercel (uploads here are at
most 650 KB), and each request may run up to 60 s (`maxDuration` in `vercel.json`).


## Private S3 uploads

See [S3 storage setup and file APIs](docs/S3_STORAGE.md) for the `Admin_Uploads` folder layout,
file inventory schema, deployment configuration, permissions, and upload/view/delete endpoints.

The [upload field and database map](docs/UPLOAD_DATABASE_AND_S3_MAP.md) lists connected upload controls,
legacy preview exceptions, database tables/columns, S3 folder rules, and SQL examples.

See [admission numbering](docs/ADMISSION_NUMBERS.md) for year/course/branch-based student IDs and the existing-student migration command.
