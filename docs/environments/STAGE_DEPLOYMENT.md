# Edu-Pragathi staging deployment record

Updated 18 November 2026. The stage environment is deployed from branch `stage`. This document records observed resources and verification; it does not imply full business UAT or mobile release acceptance.

## Current status

| Component | Stage target / result |
|---|---|
| Azure tenant / subscription | PEDRO Educational Welfare Society / `fa7aff08-db6d-4b24-bb39-95dff95cf969` |
| Resource group | `Pragathi` |
| SQL | `pragathiedu.database.windows.net` / `edu_stage` / `dbo`, Central US, General Purpose Serverless |
| SQL runtime identity | Contained user `edunexa_stage`; connection to production `eduadmin` denied |
| App Service plan | Separate `asp-edunexa-stage`, Linux B1, West US 3 |
| API | `edunexa-stage-api-pragathi`, Python 3.12, `https://edunexa-stage-api-pragathi.azurewebsites.net` |
| Dashboard | `edunexa-stage-admin-pragathi`, Node 24, `https://edunexa-stage-admin-pragathi.azurewebsites.net` |
| Custom dashboard URL | `https://stage.edu.pragathiews.org`; TLS bound; login page HTTP 200 |
| File storage | `pragathiedustage` / private `edu-stage`, West US 3; isolated Blob round-trip passed |
| Branch and GitHub environment | `stage` / `stage`; stage deployments restricted to the stage branch |
| Deployed source | `5fd5050c2104b6873dfb78597b5c39d86641ce8f` |

The user-provided database `edu_stage` was reused. Central US B1 App Service quota was unavailable, so the dedicated stage plan is in West US 3. Production apps, plan, database and DNS bindings were not repurposed.

## DNS and TLS

The existing HostGator/cPanel zone has these verified records:

| Type | Host within `pragathiews.org` | Value | TTL |
|---|---|---|---|
| CNAME | `stage.edu` | `edunexa-stage-admin-pragathi.azurewebsites.net` | 300 |
| TXT | `asuid.stage.edu` | Azure hostname ownership value | 300 |

Azure hostname and SNI TLS binding are active. Certificate thumbprint is `0243EF0E5A7AD7C1E114199E8A9D49EDAD553967`; expiry is 17 May 2027. The Azure CLI SSL-bind command failed with a deserialization error; the ARM hostname-binding API completed the binding. Production `edu` and `api` DNS records were left intact.

## Data and account scope

The schema-only model was extracted from production and initialized in the previously empty stage database. Stage contains **150 tables, 5 views and 162 DML triggers**. This was schema initialization only; production business and transactional data were not cloned.

At the user's request, the point-in-time production login snapshot was copied: **3 application accounts and 18 roles**, with login IDs, password hashes, active flags, person links, assigned roles, extra grants and client policies checked. No production sessions, OTP state, device registrations or uploaded files were copied. The temporary `stage.admin` bootstrap account and role were removed. Future production account/password changes do not synchronize automatically.

The stage SQL identity was verified against `edu_stage` and denied access to `eduadmin`. Stage has independent JWT and certificate-signing keys. Blob storage is a separate account/container with public Blob access disabled; a temporary upload/read/delete check passed.

## Runtime configuration and integrations

Stage backend settings target only `edu_stage`, the stage Blob account and stage web/API origins. Email uses the configured ACS sender with `EDUNEXA_EMAIL_ALLOWED_RECIPIENTS` restricted to active copied login email addresses. Scheduled reminders, SMS, push/FCM and payment integrations are disabled or unset. The generated runtime settings and recovery material are kept in Azure/private ignored files, not in Git.

The encrypted GitHub environment bootstrap secret `EDUNEXA_STAGE_BOOTSTRAP_SETTINGS` was used by the backend deployment to apply validated settings and was deleted after verification. Azure runtime configuration remains applied. Deployment workflows skip that optional configuration step when the secret is absent.

## CI/CD

Two GitHub Actions workflows deploy independently:

| Workflow | Behavior | Latest recorded result |
|---|---|---|
| `backend-stage.yml` | Python tests and stage guards, package, OIDC login, optional config apply, API deploy and health poll | Success; run [44202660972](https://github.com/sconexsoftrepo-1/EDU_Admin_mobile_apps/actions/runs/44202660972) |
| `admin-stage.yml` | Node 24 standalone build, package, OIDC login, dashboard deploy and login poll | Success; run [44202660890](https://github.com/sconexsoftrepo-1/EDU_Admin_mobile_apps/actions/runs/44202660890) |

Both workflows require `refs/heads/stage`, repository variable `STAGE_DEPLOY_ENABLED=true`, and the `stage` GitHub environment. Azure federation uses OIDC and a user-assigned identity with Website Contributor only on the two stage App Services. There is no production publish-profile fallback. The current subject is `repo:sconexsoftrepo-1@318086107/EDU_Admin_mobile_apps@1429245413:environment:stage`.

Production workflows still overlap on `main`; their consolidation remains separate work. The `main` ref guards added in the stage branch's copies have not been merged into production `main`.

## Verification evidence

- Stage dashboard custom-domain login page: HTTP 200.
- Stage API `/health`: HTTP 200, `status=ok`, `storage=sqlserver`, `files=azureblob`, certificate signer configured.
- Direct API roles and exact proxy URL `https://stage.edu.pragathiews.org/api/college/auth/roles`: HTTP 200; 18 roles returned.
- Authenticated API smoke: unauthenticated `/auth/me` denied; temporary stage session for a copied active administrator accessed identity and workspace endpoints directly and through the dashboard proxy; logout revoked it and subsequent access was denied. Its temporary session was revoked; no production session was used.
- Production login page read-only regression check: HTTP 200.
- SQL schema counts, production-database denial and stage Blob upload/read/delete checks passed.
- Local backend: **320 passed, 1 skipped**. Focused OTP/family/email tests: **17 passed**. Stage settings tests: **7 passed**.
- Backend GitHub CI: **315 passed, 6 skipped**, plus seven stage configuration guards. Both stage deployment workflows passed.

The original dashboard 503 happened before its Node package was deployed. The later roles API 503 happened while the frontend was live but the Python API was still in its test/build/deploy/startup sequence. Once the backend deployment completed, direct and proxied role requests returned HTTP 200. The cause was deployment readiness/order, not a DNS issue or missing role configuration.

## Remaining acceptance and planned work

Stage infrastructure, login/role parity, CI/CD, public API/proxy availability and authenticated API session handling are verified. These do not replace institutional UAT. Still to do if required:

- Perform an authorized browser sign-in with a real active account and confirm OTP mail receipt through its approved recipient address; OTP delivery itself was not independently verified in this deployment record.
- Enter or approve representative non-production business fixtures and exercise required academic, attendance, finance, reports, account administration and file workflows.
- Build/test separately configured mobile stage variants, including Firebase, app identifiers and secure-storage namespaces. Existing mobile builds remain configured for production.
- Define recovery targets and rehearse a stage restore and compatible code/schema rollback.
- Create a hosted development environment only when requested; no `develop` branch, `devdb` or development App Services were created here.

Do not copy stage data or credentials to production. Do not rerun the initial schema/bootstrap scripts as a routine deployment or refresh production logins automatically.
