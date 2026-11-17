# Edu-Pragathi staging deployment

Implementation started 18 November 2026 on local branch `stage`. This file records observed state, not a claim of completed deployment.

## Confirmed targets

| Component | Stage target |
|---|---|
| Azure account | `kattachaitanya507@gmail.com` (existing browser session) |
| Tenant | PEDRO Educational Welfare Society, `ac685c13-dc69-4450-8888-f423965b81f6` |
| Subscription | `fa7aff08-db6d-4b24-bb39-95dff95cf969` |
| Resource group | `Pragathi` |
| Database | User-created `edu_stage` on `pragathiedu.database.windows.net`, Central US |
| App Service plan | `asp-edunexa-stage`, Linux B1, West US 3; created successfully |
| API | `edunexa-stage-api-pragathi`, Python 3.12; created successfully |
| API base URL | `https://edunexa-stage-api-pragathi.azurewebsites.net` |
| Dashboard | `edunexa-stage-admin-pragathi`, Node 24; created successfully |
| Dashboard Azure URL | `https://edunexa-stage-admin-pragathi.azurewebsites.net` |
| Intended domain | `https://stage.edu.pragathiews.org` |
| Private storage | `pragathiedustage` / container `edu-stage`; created successfully; public Blob access disabled |

The latest user instructions supersede the handover's `stagedb` and `pragathinews.org` examples. The requested DB is **edu_stage** and the domain is **pragathiews.org**. Central US B1 creation was rejected for zero regional quota; a separate B1 plan was successfully created in West US 3. Production's apps/plan were not repurposed.

## DNS

Saved in the existing HostGator/cPanel DNS zone and verified through public DNS resolution:

| Type | Host within `pragathiews.org` | Value | TTL |
|---|---|---|---|
| CNAME | `stage.edu` | `edunexa-stage-admin-pragathi.azurewebsites.net` | 300 |
| TXT | `asuid.stage.edu` | `4955B365A7078FC9F165FAAF6AA683137E4842CCE2644F73512C1C8370B1C26A` | 300 |

Azure hostname binding and SNI TLS certificate binding completed. Certificate thumbprint: `0243EF0E5A7AD7C1E114199E8A9D49EDAD553967`, expires 17 May 2027. The current Cloud Shell CLI failed its SSL-bind command with a deserialization error; the documented ARM hostname-binding API completed the binding. DNS/TLS readiness is not code-deployment acceptance. Existing `edu` and `api` production records were left intact.

## Configuration prepared

- `deploy/azure/make_stage_settings.py`: explicit private input; fixes target DB/principal/container; disables push/SMS/payments and reminders; keeps OTP policy. Email can use the existing ACS service only with an explicit recipient allowlist containing the active copied login emails. Does not read/copy production `.env` automatically.
- `deploy/azure/stage-settings.example.json`: placeholders only. Keep completed input/output in ignored `deploy/azure/out/stage/`.
- `deploy/azure/initialize_stage_schema.py`: reads authorized source configuration only to extract schema; requires empty `edu_stage` for initialization; excludes logins/users/permissions and data.
- `.github/workflows/backend-stage.yml` and `admin-stage.yml`: stage ref guard, separate targets, stage environment and OIDC login variables. They are drafts until the identity and GitHub environment are configured.
- Production deployment jobs have `main` guards on this branch, preventing manual stage dispatch from targeting production.

## Database initialization

Initial read-only inspection confirmed `DB_NAME() = edu_stage` and **zero tables**. A schema-only DACPAC was extracted from `eduadmin` using Microsoft's SqlPackage, then an initialization script was generated for review. The script defines 150 tables, 5 views and 162 triggers, with no production row export or user/login creation. Its two INSERT statements are table-variable operations inside a trigger, not copied business records.

Private artifacts: `deploy/azure/out/stage/schema-only.dacpac` and `initialize-schema.sql`. Do not commit private extracted artifacts. Publishing completed successfully. The dedicated contained SQL user `edunexa_stage` connected to `edu_stage` and was explicitly denied access to `eduadmin`. The stage-only `stage.admin` account was bootstrapped with the designated tester email. Initial regex counts missed two triggers; the authoritative DACPAC model and target both contain 162 triggers.

## Validation so far

- Seven isolated stage-settings validation tests passed: correct target, rejection of production DB/API/origins, incomplete credentials, and provider settings.
- `git diff --check` passed after workflow edits.
- Public DNS returned the intended CNAME/TXT.
- Azure confirmed both new App Services and the separate plan.

## Pending acceptance

- [x] SQL schema published; target object counts compared to the extracted schema.
- [x] Dedicated SQL runtime principal restricted to `edu_stage`, with production denial proof.
- [x] Private Blob account/container and temporary upload/download/delete test passed.
- [ ] Backend settings and independent signing/JWT keys applied.
- [ ] Safe staff email delivery/test administrator and login acceptance.
- [x] Stage GitHub OIDC identity configured, Website Contributor scoped to the two stage apps.
- [ ] Workflow commit/push, builds and code deployments.
- [x] Custom hostname and TLS certificate bound; HTTP application acceptance awaits code deployment.
- [ ] Authorized DB/API/proxy smoke test and production read-only regression check.

The Azure CLI on the local machine initially used unrelated accounts; the existing authenticated Azure browser Cloud Shell was used instead. Do not use the unrelated subscription for any staging resources.

Deployment identity is now configured and repository variable `STAGE_DEPLOY_ENABLED=true` enables stage-only deployment jobs. This prevents a preparation push from attempting deployment with incomplete identity configuration. The GitHub stage environment contains `EDUNEXA_STAGE_BOOTSTRAP_SETTINGS` as an encrypted initial configuration secret; remove it after successful application to Azure. Tenant/subscription IDs are environment variables; `AZURE_STAGE_CLIENT_ID` is `9776b7c7-8406-4bb4-98b3-0b157e88c6ce`.

User follow-up explicitly requests the same production logins. `copy_stage_logins.py` previews 3 production application accounts and 18 roles; migration preserves login IDs, password hashes, active flags, client policies and permissions while excluding sessions/OTPs/devices. The temporary `stage.admin` account is retired. Runtime email delivery is restricted to the active copied login email list; scheduled reminders, SMS, push and payments remain disabled. Full local backend verification: 320 passed, 1 skipped; targeted OTP/family/email tests: 17 passed.
