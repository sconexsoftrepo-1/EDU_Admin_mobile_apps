# Codex runbook: operate staging and prepare development

Updated: 18 November 2026. Staging source release: `5fd5050c2104b6873dfb78597b5c39d86641ce8f` on `stage`. Production baseline: `fb0b8926ed8a5fc85fc73063a01b8b8cd02053cb` on `main`.

Read [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md), [PROJECT_INVENTORY.md](PROJECT_INVENTORY.md) and [the deployment evidence](environments/STAGE_DEPLOYMENT.md). **Stage resources and both application deployments now exist. Verify and maintain them; do not recreate them from the old proposal.** Hosted development remains future work.

## 1. Authoritative decisions

The user created **`edu_stage`** on the existing SQL server **`pragathiedu`** and requested the domain **`stage.edu.pragathiews.org`**. These supersede the earlier `stagedb` and `pragathinews.org` examples. The user also explicitly requested the **same application logins as production** and the same test/build/deploy sequence as `main`.

The initial production identity snapshot contained **3 application accounts and 18 roles**. Login IDs, password hashes, active state, person links, assigned roles, extra grants and client policies were copied and verified. Production sessions, OTP state, device registrations, financial/academic transactions and file bytes were not copied. The temporary `stage.admin` bootstrap login/role were removed. This identity snapshot does not continuously synchronize future password/account changes from production.

Same login behavior means staff continue using email OTP; parent/student password behavior remains in the code. Stage JWT/session/signing secrets and SQL credentials are independent from production. The newly created SQL database started empty and received the authoritative SQL Server schema. It is not a full copy of production business data.

## 2. Actual resources

| Property | Production | Stage | Development proposal |
|---|---|---|---|
| Branch | `main` | `stage` | `develop` |
| Web | `https://edu.pragathiews.org` | `https://stage.edu.pragathiews.org` | `https://dev.edu.pragathiews.org` if hosted |
| API | `https://edunexa-api-pragathi-dpaafqe8ftbabxay.westus3-01.azurewebsites.net` (`api.pragathiews.org` CNAME also exists) | `https://edunexa-stage-api-pragathi.azurewebsites.net` | Separate dev API or local port 8010 |
| Backend app | `edunexa-api-pragathi` | `edunexa-stage-api-pragathi` | `edunexa-dev-api-pragathi` if available |
| Frontend app | `edunexa-admin-pragathi` | `edunexa-stage-admin-pragathi` | `edunexa-dev-admin-pragathi` if available |
| Plan | `asp-edunexa`, Linux B1, West US 3 | Separate `asp-edunexa-stage`, Linux B1, West US 3 | Separate or explicitly approved non-production plan |
| SQL server / database | `pragathiedu.database.windows.net` / `eduadmin` | Same logical server / **`edu_stage`**, schema `dbo`, Central US | `devdb`, separate principal |
| SQL runtime principal | Existing production credential | Contained **`edunexa_stage`**; production connection denial verified | Separate contained dev user |
| Blob | Existing production storage | Separate account **`pragathiedustage`**, private **`edu-stage`**, prefix `uploads`, West US 3 | Separate dev storage |
| GitHub environment | Existing production workflow configuration | **`stage`**, restricted to branch `stage` | `development`, restricted to `develop` |
| Deployment identity | Existing publish-profile workflows | **`edunexa-stage-github`**, OIDC, stage apps only | Separate identity |

Tenant: PEDRO Educational Welfare Society, `ac685c13-dc69-4450-8888-f423965b81f6`. Subscription: `fa7aff08-db6d-4b24-bb39-95dff95cf969`. Resource group: **`Pragathi`**.

Central US B1 creation was rejected because regional quota was zero. Stage therefore has a separate B1 plan in West US 3. The database remains in Central US. Do not describe the API and database as co-located, and do not move production resources to resolve this difference.

Azure app names cannot contain underscores. The user's logical `stage_appservice` label is implemented by the separate valid backend/frontend names above. Azure naming reference: [Microsoft resource name rules](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules).

## 3. Verified release status

- Dashboard standalone build and deployment passed: [frontend run](https://github.com/sconexsoftrepo-1/EDU_Admin_mobile_apps/actions/runs/44202660890).
- Backend tests, stage guards, settings application, code deployment and health check passed: [backend run](https://github.com/sconexsoftrepo-1/EDU_Admin_mobile_apps/actions/runs/44202660972).
- Custom-domain `/portal/login`: **HTTP 200**.
- Exact user-reported `/api/college/auth/roles`: **HTTP 200**, 18 roles.
- Direct stage API `/health`: **HTTP 200**, `storage=sqlserver`, `files=azureblob`, `certificate_signing=configured`.
- SQL schema matched to the extracted source DACPAC: **150 tables, 5 views, 162 DML triggers**.
- Stage runtime SQL user connected to `edu_stage` and was explicitly denied access to `eduadmin`.
- Private stage Blob upload/download/delete round-trip passed; temporary test object removed.
- Local backend tests: **320 passed, 1 skipped**. GitHub Python 3.12 run: **315 passed, 6 skipped**. Seven deployment configuration guards passed. Focused OTP/family/email tests: **17 passed**.

These are deployment/data-plane checks. Full business UAT, native stage releases, recovery rehearsals and a hosted dev environment are not complete merely because these checks passed. See the deployment evidence for authenticated-session and final follow-up results.

## 4. Branch-bound CI/CD

Stage preserves the production sequence while using independent resources and OIDC authentication:

```text
push stage (relevant paths)
  -> backend tests + configuration guards -> backend-only ZIP
  -> stage OIDC login -> optional initial settings -> stage API deploy -> /health

push stage (relevant paths)
  -> Node 24 npm ci/build -> standalone/static/public ZIP
  -> stage OIDC login -> stage dashboard deploy -> /portal/login
```

Files: `.github/workflows/backend-stage.yml` and `.github/workflows/admin-stage.yml`. Deploy jobs require `github.ref == 'refs/heads/stage'` and repository variable **`STAGE_DEPLOY_ENABLED=true`**. GitHub environment `stage` additionally permits the stage branch only. Concurrency groups are independent per stage app and do not cancel an in-progress deployment.

Environment variables:

| Variable | Current value |
|---|---|
| `AZURE_STAGE_CLIENT_ID` | `9776b7c7-8406-4bb4-98b3-0b157e88c6ce` |
| `AZURE_STAGE_TENANT_ID` | `ac685c13-dc69-4450-8888-f423965b81f6` |
| `AZURE_STAGE_SUBSCRIPTION_ID` | `fa7aff08-db6d-4b24-bb39-95dff95cf969` |

Azure identity **`edunexa-stage-github`** has Website Contributor on the **two stage App Services only**. Its federated audience is `api://AzureADTokenExchange`, issuer is `https://token.actions.githubusercontent.com`, and the actual repository subject is:

```text
repo:sconexsoftrepo-1@318086107/EDU_Admin_mobile_apps@1429245413:environment:stage
```

The first frontend attempt failed because the initial name-only subject did not match GitHub's assertion containing immutable IDs. Matching the actual subject fixed authentication; a rerun passed. Recheck the presented subject if federation configuration changes. Do not grant subscription-wide Contributor as a workaround. [Microsoft OIDC deployment guidance](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid).

The three production workflows remain enabled on `main`, including the overlapping generated frontend workflow. Their copies on `stage` have `main` guards, but production consolidation/hardening has not been merged to `main`. Do not imply that production's overlapping pipeline issue has already been resolved.

## 5. Runtime configuration and secrets

Use **`make_stage_settings.py`**, not the production `make_backend_settings.py` or its shared output. The stage generator requires explicit private input and validates DB/principal/origin boundaries. Actual values remain in ignored `deploy/azure/out/stage/` or Azure/GitHub secret stores. Never paste them into chat, public guides, logs or committed files.

| Setting | Stage policy |
|---|---|
| `EDUNEXA_STORAGE_BACKEND` | `sqlserver` |
| `EDUNEXA_MSSQL_HOST` / `NAME` | `pragathiedu.database.windows.net` / `edu_stage` |
| `EDUNEXA_MSSQL_USER` / `PASSWORD` | `edunexa_stage` / independent private password |
| `EDUNEXA_MSSQL_DB_SCHEMA` / `PORT` | `dbo` / `1433` |
| `EDUNEXA_MSSQL_ENCRYPTION` | `require` |
| `EDUNEXA_JWT_SECRET` | Independent generated stage secret, at least 48 characters |
| `EDUNEXA_ISSUER` | `edunexa-stage-api` |
| `EDUNEXA_CERTIFICATE_SIGNING_KEY` | Independent stage Ed25519 private key |
| `EDUNEXA_FILE_STORAGE` | `azure` |
| `EDUNEXA_AZURE_STORAGE_ACCOUNT` / `CONTAINER` / `PREFIX` | `pragathiedustage` / `edu-stage` / `uploads` |
| `EDUNEXA_AZURE_STORAGE_KEY` | Stage account key, never the production storage key |
| `EDUNEXA_PUBLIC_API_URL` | `https://edunexa-stage-api-pragathi.azurewebsites.net` |
| `EDUNEXA_PUBLIC_PORTAL_URL` | `https://stage.edu.pragathiews.org` |
| `EDUNEXA_CORS_ORIGINS` | JSON array: stage custom domain and stage Azure frontend origin |
| `EDUNEXA_STAFF_PASSWORD_LOGIN` | `false`, preserving staff email OTP |
| `EDUNEXA_EMAIL_CONNECTION_STRING` / `EMAIL_SENDER` | Existing ACS sender configuration, explicitly supplied for stage |
| `EDUNEXA_EMAIL_ALLOWED_RECIPIENTS` | JSON list of active copied login emails; no unrestricted stage delivery |
| `EDUNEXA_SEMESTER_REMINDERS_ENABLED` | `false` |
| Push/FCM, SMS, payment adapter settings | Empty/disabled |
| `EDUNEXA_API_DOCS` | `false` |
| `EDUNEXA_DATA_DIR` / `TZ` | `/home/data/edunexa` / `Asia/Kolkata` |

Grouped variable suffixes above inherit their complete prefix, e.g. SQL `NAME` means `EDUNEXA_MSSQL_NAME`, and Azure `CONTAINER` means `EDUNEXA_AZURE_STORAGE_CONTAINER`. Use exact names in `settings.py` and `sqlserver.py` when editing configuration.

Frontend settings include `EDUNEXA_API_URL=https://edunexa-stage-api-pragathi.azurewebsites.net`, `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=8080`, `WEBSITES_PORT=8080`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. Startup: `node server.js`. Backend uses `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, Python 3.12, startup `sh startup.sh`, one Uvicorn worker. Both apps require HTTPS and TLS 1.2 or higher; FTPS is disabled.

The CI bootstrap secret **`EDUNEXA_STAGE_BOOTSTRAP_SETTINGS`** was used to apply validated settings and has been deleted after acceptance. Runtime values remain in Azure and the approved private recovery location. Ordinary later deployments retain existing settings. Recreate the secret only for a deliberate validated configuration update; never commit its contents.

### Email behavior

`email_delivery.py` now checks `EDUNEXA_EMAIL_ALLOWED_RECIPIENTS` before contacting ACS. `None` preserves existing unrestricted behavior outside stage; `[]` blocks all delivery; stage uses an explicit list. The list was expanded from the initial tester mailbox to the active copied production-login emails after the user requested identical logins.

Only user-requested login activity should send real OTPs during acceptance. Stage reminders remain off. New stage accounts will need an explicitly approved recipient-list update before OTP delivery can reach a new address. Provider acceptance is not proof of mailbox receipt. This is a shared ACS service with a stage application delivery restriction, not a separately provisioned email service.

## 6. Database and account maintenance

The schema-only source extraction used SqlPackage and excluded data, SQL users/logins, permissions and role memberships. The SQL runtime principal is contained in `edu_stage`, with reader/writer/execute rights needed by the application. Production SQL credentials are not the stage runtime credential.

Relevant tools:

| Tool | Use / guard |
|---|---|
| `initialize_stage_schema.py` | Extract schema, generate reviewed SQL, publish only to an **empty** `edu_stage`; refuses a populated schema |
| `prepare_stage_database.py` | Initial contained user/key/bootstrap creation; not a daily deployment step |
| `copy_stage_logins.py` | Preview, then explicit account/role parity migration; source is a read-only production snapshot |
| `verify_stage_data.py` | Check SQL schema/active administrator and stage Blob round-trip |
| `make_stage_settings.py` | Explicit private JSON input to stage app settings |
| `apply_stage_settings.py` | Validate/apply optional CI bootstrap secret to stage API only |

Do not rerun the bootstrap/schema initializer against the deployed database as a migration strategy. Do not automatically refresh logins or production data on every push. A future account refresh requires review of existing stage identities, email allowlist, session revocation and changed permissions. Preserve existing business records and audit history unless a specific disposable-stage reset was requested.

The current account snapshot contains system logins, so the copy did not require linked employee/student/guardian business rows. The migration tool supports explicit identity dependencies for future linked accounts but is not a general production database clone. It does not copy financial activity, grades, chat messages, certificates or file bytes.

PostgreSQL/MySQL schema files remain reference assets. Do not execute those directly as Azure SQL DDL. A general ordered SQL Server migration runner and restore rehearsal are still follow-up work.

## 7. DNS and certificate operations

These records are saved in the existing cPanel/HostGator `pragathiews.org` zone:

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `stage.edu` | `edunexa-stage-admin-pragathi.azurewebsites.net` | 300 |
| TXT | `asuid.stage.edu` | `4955B365A7078FC9F165FAAF6AA683137E4842CCE2644F73512C1C8370B1C26A` | 300 |

Azure hostname `stage.edu.pragathiews.org` is bound to the stage frontend with SNI. Managed certificate thumbprint: `0243EF0E5A7AD7C1E114199E8A9D49EDAD553967`; observed expiry: 17 May 2027. Production `edu` / `api` records were not changed. No separate stage API custom hostname is needed for the current setup.

The Cloud Shell CLI's SSL-bind command failed with `NoneType` host-name deserialization. The existing certificate was successfully bound with the documented ARM `PUT .../sites/{app}/hostNameBindings/{hostname}?api-version=2024-11-01` operation, setting `sslState=SniEnabled` and the certificate thumbprint. Do not disable certificate validation or recreate resources to work around that CLI error. [Microsoft hostname-binding API](https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-or-update-host-name-binding?view=rest-appservice-2024-11-01).

## 8. Daily deployment and 503 troubleshooting

Work on `stage`, review changes, run relevant checks and push to `origin stage`. Watch both stage workflows. A frontend-only successful build is insufficient if the API is still deploying. Documentation-only changes do not trigger the stage deployment path filters.

Check the three layers independently:

```bash
curl -fsS https://edunexa-stage-api-pragathi.azurewebsites.net/health
curl -fsS https://edunexa-stage-api-pragathi.azurewebsites.net/api/v1/auth/roles
curl -fsS https://stage.edu.pragathiews.org/api/college/auth/roles
```

Expected: health `status=ok`, `storage=sqlserver`, `files=azureblob`, signer configured; direct and proxied role lists return HTTP 200. `/auth/me` without a session should be unauthorized.

The initial dashboard 503 occurred before its Node package was deployed. That cleared after frontend deployment. The later **roles API 503** occurred because the frontend was already live while the Python API was still in its test/build/deploy/startup sequence. Backend deployment then passed and the exact proxied roles URL returned HTTP 200 with 18 roles. This was initial deployment ordering/availability, not a DNS repair or role-permission change.

For a recurrence:

1. Check direct API health, direct roles and proxied roles separately.
2. If health is unavailable, inspect the backend workflow and Azure startup logs; verify Python runtime, `sh startup.sh`, dependency installation, port and required settings.
3. If health works but direct roles fails, inspect SQL connectivity, contained user access, schema and database wake-up. `/health` alone does not query SQL. The stage database is serverless and may pause after inactivity.
4. If direct roles works but proxied roles fails, verify the frontend's **runtime** `EDUNEXA_API_URL`, upstream TLS/reachability and the proxy timeout (25 seconds).
5. If public roles works but sign-in fails, verify role assignment/client policy, active account, staff OTP sender/allowlist, code expiration and session-cookie behavior. Do not enable password fallback or broaden access merely to hide the error.
6. For an OIDC failure, match issuer/audience/the actual presented subject and inspect stage app-scoped role assignments; do not use production publish-profile secrets.

Keep logs free of connection strings, keys, OTP values, password hashes and bearer/refresh tokens. A response from the public login page does not prove authenticated access.

## 9. Release acceptance and rollback

Completed: independent apps/plan/storage; schema and SQL isolation; copied login/role parity; DNS/TLS; branch/environment controls; backend/frontend CI/deploy success; public health and proxied role responses; local and CI tests; Blob round-trip; read-only production login-page HTTP 200.

Still validate separately before treating stage as full institutional acceptance: authenticated session/OTP receipt where not yet recorded, every required business workflow with representative stage records, all client import templates, physical mobile builds/push, payment sandbox, recovery targets and restore/rollback rehearsal. Empty finance/student screens are expected until stage business data is entered or an explicitly approved data migration occurs.

Record release SHA, run URLs, settings snapshot location, schema version and test results. Roll code back to a retained compatible artifact/SHA; code rollback does not undo data/schema changes. Rehearse schema changes in stage first and use additive compatible migrations where possible. Never copy stage over production or promote stage sessions/secrets/data when merging code into `main`.

## 10. Development and mobile follow-up

No hosted development resource or `develop` branch was created in this staging task. For development, confirm branch convention, create an independent `devdb` and contained user, separate API/frontend/storage and secrets, then provision a `development` GitHub environment and identity restricted to that branch/resources. Recheck quotas and actual runtime availability. Existing stage tools deliberately hardcode stage targets; extend and test explicit environment parameters rather than blindly replacing strings or feeding them production `.env`.

Local work can use `local-json` and local files for fast testing. Azure SQL integration acceptance must still run against a private database/schema. Never run destructive integration fixtures against production.

Existing mobile builds continue to use their configured production backend. For each Flutter project, a stage build must explicitly use:

```bash
flutter run --dart-define=API_BASE_URL=https://edunexa-stage-api-pragathi.azurewebsites.net --dart-define=ALLOW_INSECURE_HTTP=false
```

Separate stage package/bundle IDs, secure-storage namespaces, Firebase registrations, names and signing/distribution are future work for side-by-side installations. Native stage artifacts were not built in this task. A visible stage badge and no-index metadata are also follow-up UI changes, not claimed implemented behavior.

### Task for a future Codex session

> Read the three project docs and `docs/environments/STAGE_DEPLOYMENT.md`. Verify current stage health, direct/proxied roles and latest successful run/SHA before making changes. Preserve the existing `edu_stage`, App Services, private storage and production login behavior. Complete any remaining recorded acceptance, migration/recovery and mobile-stage work without claiming untested flows passed. If asked to create development, implement it with independent resources/credentials and branch-bound CI/CD, following the actual confirmed topology rather than obsolete `stagedb` or domain examples. Do not recreate a working stage environment or change production as a shortcut.
