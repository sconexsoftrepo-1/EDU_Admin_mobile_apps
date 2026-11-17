# Codex instructions: reproduce Edu-Pragathi as isolated stage and development environments

Prepared: 18 November 2026. Repository baseline: `main`, `fb0b8926ed8a5fc85fc73063a01b8b8cd02053cb`.

This is an implementation runbook for the next Codex session. **Implementation started on the `stage` branch. The user created `edu_stage` on `pragathiedu`; Azure application provisioning and acceptance remain pending.** Read [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md) and [PROJECT_INVENTORY.md](PROJECT_INVENTORY.md) first.

## 1. Objective and intended topology

Preserve production on `main`. Create an equivalent isolated stage environment driven by `stage`, including database **`edu_stage`**, separate backend App Service, separate frontend App Service, private file storage, credentials, domain **`stage.edu.pragathiews.org`**, mobile configuration and CI/CD. Create a separate development environment using `develop` as the proposed branch and `devdb` as the proposed database. Use local development for ordinary work, and a hosted dev environment for integration if required.

The user's label **`stage_appservice`** describes the requested staging service. Azure Web App names allow alphanumerics and hyphens, not underscores: use a valid available name such as `edunexa-stage-api-pragathi`, and record the mapping. There must also be a separate frontend app such as `edunexa-stage-admin-pragathi`. Do not silently create one service and treat it as both runtimes. [Microsoft naming rules](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules).

| Property | Production | Stage | Development proposal |
|---|---|---|---|
| Branch | `main` | `stage` | `develop` |
| GitHub environment | `production` | `stage` | `development` |
| Web domain | `edu.pragathiews.org` — user supplied, verify binding | `stage.edu.pragathiews.org` | `dev.edu.pragathiews.org` if hosted |
| API domain | Discover actual hostname | Azure default hostname initially; optional `api.stage.edu.pragathiews.org` | Local `127.0.0.1:8010` or separate hosted API |
| Backend app | Workflow: `edunexa-api-pragathi`; verify actual resource | `edunexa-stage-api-pragathi`, availability permitting | `edunexa-dev-api-pragathi` if hosted |
| Frontend app | Workflow: `edunexa-admin-pragathi`; verify actual resource | `edunexa-stage-admin-pragathi` | `edunexa-dev-admin-pragathi` if hosted |
| Database | Discover live DB; local candidate `eduadmin` | **`edu_stage`** | `devdb` |
| SQL schema | Discover; local `dbo` | `dbo` unless deliberately changed | `dbo` |
| SQL user | Existing production principal | Separate stage-only principal | Separate dev-only principal |
| Blob | Discover; local candidate `pragathiedu` / `edu` / `uploads` | Separate storage account preferred; private `edu-stage` container | Separate account/private `edu-dev` container |
| JWT / certificate keys | Existing production keys retained | New environment-specific keys | New environment-specific keys |
| Email/push/payment/SMS | Existing verified live settings | Test-only integrations and recipients | Disabled or test-only |
| Reminder worker | Existing production policy | Disabled by default | Disabled by default |

App names, API custom domains, hosted dev domain and `develop`/`devdb` are proposals; `stage`, `edu_stage` and `stage.edu.pragathiews.org` are user requirements. Do not overwrite an unrelated existing resource with a matching proposed name. Separate App Services are the requested design, rather than production deployment slots.

## 2. Execution contract for Codex

Proceed with repository analysis, reversible preparation and verification. Implement changes in an isolated checkout/worktree or appropriate feature branch. Respect the current working tree and applicable `AGENTS.md`; do not discard unrelated work. The user has requested this guide as the next-step instruction, so this file itself is not a record that cloud execution has already been approved/performed.

When executing the future setup task, make the resulting plan/configuration reviewable, use the task's existing authorization and tool permission requirements, and ask only for missing access or genuinely unresolved decisions. Never put secrets in a chat response or committed artifact. Never mutate production data, DNS bindings, signing keys or credentials as a shortcut to make staging work.

Use actual resource discovery to fill placeholders. If a required account/permission is unavailable, finish independent work and report the exact missing capability; do not invent resource IDs or success. Track work in a checklist with evidence and mark unfinished acceptance honestly.

## 3. Phase A — discover the real deployment before copying

Record a sanitized inventory in `docs/environments/ENVIRONMENT_INVENTORY.md` (new deliverable): subscription/tenant IDs, resource IDs/names, resource groups, regions, OS/runtime, plans/SKUs, instance count, hostnames/domains/TLS, deployment identity, DB server/name/schema/SKU/networking, Blob account/container, provider configuration status, backups and monitoring. Record secret **names and retrieval locations**, never values.

Read these source files before editing:

- `.github/workflows/backend-azure.yml`, `admin-azure.yml`, `main_edunexa-admin-pragathi.yml`.
- `deploy/azure/{README.md,CICD.md,make_backend_settings.py,package.sh,deploy.sh}`.
- `backend/app/core/{settings.py,sqlserver.py,files.py,security.py,otp_login.py,family_access.py}`.
- `backend/app/main.py`, `backend/startup.sh`, SQL Server changes and database tools.
- Next proxy `admin-dashboard/src/app/api/college/[...path]/route.ts` and `next.config.ts`.
- Both Flutter `lib/constants/api_config.dart`, Android/iOS manifests/build settings, Firebase registration files.

Safe discovery examples (requires authenticated CLI; do not paste raw app settings or deployment profiles):

```bash
az account show --query '{subscription:id,tenant:tenantId,name:name}' -o json
az webapp list --query '[].{name:name,group:resourceGroup,location:location,host:defaultHostName,plan:serverFarmId}' -o json
az sql server list --query '[].{name:name,group:resourceGroup,location:location,fqdn:fullyQualifiedDomainName}' -o json
az storage account list --query '[].{name:name,group:resourceGroup,location:location}' -o json
gh workflow list --all
```

Query known resources with explicit subscription/group/name afterward. Obtain necessary settings through secure tooling and save only redacted summaries. Check GitHub Deployment Center links, enabled workflows, recent runs, environments, secrets/variables **names**, branch protections and manual dispatch permissions.

Conflicting repository clues that must be resolved:

- Local candidate: `pragathiedu.database.windows.net` / `eduadmin`; older Azure notes: `edupragathi.database.windows.net` / `edu-dev`.
- Mobile defaults use a generated `westus3-01.azurewebsites.net` hostname; older notes prescribe Southeast Asia and others describe West US 3.
- Local backend public API URL still refers to an older HTTP IP. Do not use it as the live URL.
- A shared production plan is documented, but actual plan/SKU/regions have not been verified.

Use `az webapp show ... --query defaultHostName -o tsv` to obtain actual generated hostnames. Do not assume `<app-name>.azurewebsites.net` is always the deployed hostname.

## 4. Phase B — branches and CI containment

1. Inspect working tree, fetch authorized refs, record current production SHA and latest successful deployment artifacts.
2. Audit the generated `main_edunexa-admin-pragathi.yml`: it targets the same production frontend as `admin-azure.yml`, uploads the repository, lacks the curated build and triggers on all `main` pushes. Confirm whether enabled. Prepare a reviewed consolidation/retirement so only one frontend pipeline owns production.
3. Add explicit `main` checks to production deploy jobs, including `workflow_dispatch`. Existing manual workflows can be run from another ref while still targeting production.
4. Create `stage` from a known good `main` baseline if absent. Preserve an existing stage branch's work. Create `develop` if the agreed development branch is absent. Use a worktree if switching would disturb changes.
5. Add explicit stage/dev workflows, variables and credentials, ensuring no non-production ref can resolve to production resource names or profiles. Do not copy a workflow, change only its push branch, and leave its target app unchanged.
6. Proposed promotion flow: feature branch → `develop` → `stage` for UAT → reviewed PR into `main`. Database contents and secrets are never promoted by merging branches. Record the tested SHA; merging may produce a new SHA, so rerun required checks or prove identical artifact/source content.

Production hardening must be reviewed before it is merged, because workflow-file changes themselves trigger deployments. Stage work should not accidentally enqueue an uncontrolled production run.

## 5. Phase C — isolate SQL and choose a data strategy

Use Azure SQL Database for stage/dev parity with current SQL Server runtime. Place stage API near its database after confirming actual production region; shared plans may save cost but share capacity/blast radius. Prefer a dedicated non-production plan and separate resource group. Reusing a logical SQL server is possible only with separate users and explicit access isolation.

Two supported provisioning strategies:

**A. Schema plus synthetic records (preferred for routine development).** Extract the authoritative SQL Server schema or create a tested SQL Server schema deployment artifact from the current database. Apply it to new `edu_stage`/`devdb`, then insert fictional configuration/accounts and representative business records. The repo has PostgreSQL/MySQL reference schemas and incremental SQL Server scripts, not a proven complete blank SQL Server installer. Do not execute `edunexa_schema_postgresql.sql` or PostgreSQL tools as Azure SQL DDL.

**B. Independent production copy, then sanitize before application start.** A database copy includes users/permissions as well as data, so copied access must be reviewed. Wait for Online, create separate runtime users, sanitize the target and prove no production secrets/session state remain before allowing requests. An example shape, after filling verified names:

```bash
az sql db copy --resource-group "$SOURCE_GROUP" --server "$SOURCE_SQL_SERVER" --name "$SOURCE_DATABASE" \
  --dest-resource-group "$STAGE_GROUP" --dest-server "$STAGE_SQL_SERVER" --dest-name edu_stage
```

This is a future mutation example; do not run with unresolved variables or guess source/target. Database copies are independent; user/login behavior across servers and permission requirements must be validated. [Microsoft database copy guide](https://learn.microsoft.com/en-us/azure/azure-sql/database/database-copy?view=azuresql).

For either strategy:

- Assert target database is `edu_stage` or `devdb`, and is different from production, **before any write**. Query `DB_NAME()` through the target connection. Deny unapproved target names in migration/sanitization tools.
- Inventory actual tables, foreign keys, triggers, constraints, indexes, views, sequences/identities, schema migrations and `record_extras`. Reconcile to current contracts and SQL Server scripts `011`–`013`; numbering alone is not proof earlier changes were applied.
- Use a stage-specific SQL principal with only needed rights. Remove/disable copied production principals on the copied DB where safe. A server admin credential would defeat DB isolation; do not reuse it as the stage runtime user.
- Clear copied refresh sessions/token families, login attempts, OTP/setup codes, device registrations and provider callback/idempotency state that must not carry into tests. Inspect the actual SQL mapping: internal document collections can reside in shared metadata/extras rather than obvious standalone tables.
- Replace business PII/contact details, addresses, IDs, financial references, messages and attachment references with coherent synthetic values; preserve relationships and required constraints. Do not merely mask names while leaving real recipient emails or phone numbers.
- Provision named test Super Admin, limited office user, faculty, clerk, lab in-charge, student and two guardians/children to test both allowed and denied scope. Never use copied production credentials for UAT.
- Preserve coherent test ledgers and receipts or rebuild them transactionally. Capture before/after schema and sanitized row-count reports with no PII.
- Do not run seed or destructive integration-test tools against production; inspect `bootstrap_admin.py`, `seed_demo.py`, `seed_linked_academics.py` and opt-in test fixtures before use.

Do not automatically wipe a stage database on every deployment. Treat refresh-from-production as a deliberate audited operation with target checks, sanitization, side-effect shutdown and a recovery checkpoint.

## 6. Phase D — isolate Blob data and signing material

1. Create private non-production Blob storage. Separate accounts/keys are preferable; a separate container with a production account key changes the path but does not restrict that credential to the container.
2. Set `EDUNEXA_FILE_STORAGE=azure`, the non-production account/credential, container and a valid prefix such as `uploads`. `AzureBlobFiles` currently validates prefix as a single key component; do not assume a proposed nested prefix like `stage/uploads` will validate.
3. Use sample/sanitized files only. A copied SQL DB does not copy Blob bytes. Review `documents`, `file_storage_objects`, photos, deposit proofs, learning files, certificates and chat attachments for stored object keys/provider/container fields, then rewrite or remove references coherently.
4. Prove upload and download operate on stage objects. Use unique stage object names, deny anonymous access, and verify read SAS expiration. Test that a stage user cannot obtain production files.
5. Generate independent JWT and Ed25519 certificate signing secrets for each environment. Never overwrite the production signer. Use stage verification URLs and clearly marked test certificates; do not distribute copied production certificates as stage-generated outputs.
6. Place secrets in App Service settings or an approved vault. A managed identity/Key Vault design is possible, but current Blob adapter uses an account key/connection string and SQL uses username/password; do not claim managed identity works without adding and testing the code/configuration.

## 7. Phase E — configuration matrix and safe settings generation

Create a checked-in **placeholder-only** template and validation tool, with actual values in ignored environment files or a secrets store. Support explicit `--env-file`, `--environment`, `--output`, API/portal URLs and expected DB targets; fail closed on unresolved placeholders or production references for stage/dev. Use separate private output paths per environment.

Do not invoke `make_backend_settings.py` unchanged for stage: it always reads `backend/.env`, can reuse the production signing key, copies all provider settings and writes a common output. Do not swap production `.env` files in/out temporarily as a workaround. Refactor safely while preserving existing production behavior, or build a dedicated environment-aware tool.

| Setting | Stage / hosted dev requirement |
|---|---|
| `EDUNEXA_STORAGE_BACKEND` | `sqlserver` |
| `EDUNEXA_MSSQL_HOST`, `PORT` | Verified non-production server / normally 1433 |
| `EDUNEXA_MSSQL_NAME` | Exactly `edu_stage` / `devdb` |
| `EDUNEXA_MSSQL_USER`, `PASSWORD` | Independent limited runtime credential |
| `EDUNEXA_MSSQL_DB_SCHEMA` | `dbo` unless chosen otherwise; not `EDUNEXA_MSSQL_SCHEMA` |
| `EDUNEXA_MSSQL_ENCRYPTION` | `require` or supported `strict` |
| `EDUNEXA_MSSQL_CONNECT_TIMEOUT`, `QUERY_TIMEOUT` | Validate against `SqlServerSettings`; defaults 10 / 30 seconds |
| `EDUNEXA_JWT_SECRET` | New random secret, at least 48 characters; never production value |
| `EDUNEXA_ISSUER`, `AUDIENCE` | Optional distinct stage/dev values with tested client compatibility |
| `EDUNEXA_DATA_DIR` | `/home/data/edunexa` per separate App Service |
| `EDUNEXA_FILE_STORAGE` | `azure` for parity |
| `EDUNEXA_AZURE_STORAGE_ACCOUNT`, `STORAGE_KEY` | Non-production account/key; or the connection-string path below |
| `EDUNEXA_AZURE_STORAGE_CONNECTION_STRING` | Optional alternative; secret, non-production only |
| `EDUNEXA_AZURE_STORAGE_CONTAINER`, `STORAGE_PREFIX` | `edu-stage` / `edu-dev`, prefix `uploads` |
| `EDUNEXA_CERTIFICATE_SIGNING_KEY` | New base64-encoded 32-byte Ed25519 private key |
| `EDUNEXA_PUBLIC_API_URL` | Actual stage/dev HTTPS API hostname |
| `EDUNEXA_PUBLIC_PORTAL_URL` | `https://stage.edu.pragathiews.org` / dev URL |
| `EDUNEXA_CORS_ORIGINS` | JSON array of explicit non-production browser origins |
| `EDUNEXA_API_DOCS` | Prefer false on public stage; enable only for controlled internal dev |
| `EDUNEXA_SEMESTER_REMINDERS_ENABLED` | `false` until controlled reminder testing |
| `EDUNEXA_STAFF_PASSWORD_LOGIN` | `false` for OTP parity, with safe email configured |
| `EDUNEXA_EMAIL_CONNECTION_STRING`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME` | Test sender/service and controlled addresses |
| `EDUNEXA_STUDENT_APP_LINK` | Stage/dev distribution link or unset; never a misleading production link |
| `EDUNEXA_FCM_SERVICE_ACCOUNT_JSON` or `FCM_SERVICE_ACCOUNT_FILE` | Separate test Firebase project/credential, or unset |
| `EDUNEXA_PUSH_ADAPTER_URL`, `PUSH_ADAPTER_TOKEN` | Test adapter, or unset |
| `EDUNEXA_SMS_ADAPTER_URL`, `SMS_ADAPTER_TOKEN` | Sandbox/test adapter, or unset |
| `EDUNEXA_PAYMENT_ADAPTER_URL`, `PAYMENT_ADAPTER_TOKEN`, `PAYMENT_CALLBACK_SECRET` | Sandbox-only with separate callback secret, or unset |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | Backend `true`; frontend `false` |
| `WEBSITES_PORT` | Backend 8000; frontend 8080, consistent with selected runtime |
| `TZ` | `Asia/Kolkata` |

All uppercase names in shortened matrix groups inherit the `EDUNEXA_` prefix shown on the first member, e.g. `EMAIL_SENDER` means `EDUNEXA_EMAIL_SENDER`, and `STORAGE_KEY` in the Azure row means `EDUNEXA_AZURE_STORAGE_KEY`. Use actual `settings.py` and `sqlserver.py` names in generated files.

Frontend App Service: `EDUNEXA_API_URL=<stage/dev API>`, `NODE_ENV=production` for the deployed Node server, `HOSTNAME=0.0.0.0`, `PORT=8080`, `WEBSITES_PORT=8080`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `NEXT_TELEMETRY_DISABLED=1`. `NODE_ENV=production` is a runtime optimization setting and does not mean the deployment uses production data.

Build `NEXT_PUBLIC_BUILD_ID` from the deployed SHA. Do not expose DB/provider secrets via `NEXT_PUBLIC_*` or Dart defines. Add an explicit visible STAGE/DEVELOPMENT badge and distinct app title/branding using a new, documented configuration switch; such a switch is not already implemented merely because this guide requests it. Exclude non-production pages from indexing through appropriate robots/metadata and access controls; robots rules do not provide authentication.

### Outbound safety before starting a copied environment

The application can send OTP, welcome emails, notices and push outside the hourly reminder worker. Disabling reminders alone is insufficient. This code does not currently provide a universal recipient-allowlist switch. Implement and test an email/SMS/push allowlist/redirect at the delivery boundary or use isolated services with only controlled recipients and sanitized data. Keep payment adapters unset until a sandbox is ready. Never provide fake successful OTP/payment delivery to conceal missing services.

For staff login testing, configure test email delivery to actual approved tester mailboxes. If credentials are unavailable, retain explicit unavailable behavior and mark OTP acceptance incomplete; do not enable public password fallback without documenting and testing the policy change.

## 8. Phase F — provision two runtimes per hosted environment

Use idempotent environment-specific IaC (Bicep/Terraform) or guarded CLI scripts. Require explicit subscription/resource group/environment/target arguments and tags. Record what already exists; don't replace a resource automatically.

Provision SQL/storage and private settings first, then:

1. Linux App Service plan near the database, with verified SKU/capacity. Record cost/resource choices; old price estimates are not current quotes.
2. Backend web app: Python 3.12 compatible with the repo, startup `sh startup.sh`, HTTPS only, minimum TLS 1.2+, health path `/health`, one instance/worker and persistent home as required.
3. Frontend web app: Node 24 per pipeline, startup `node server.js`, HTTPS only, correct port/upstream.
4. Network access only where needed; avoid copying the old blanket "allow all Azure services" instruction without considering narrower networking. Validate actual SQL TLS/firewall access and Blob permissions.
5. Separate diagnostic logs/alerts and, if configured, environment-specific Application Insights. Monitoring is a new setup task, not an already verified repo capability.
6. Deploy backend-only and standalone frontend packages. Review archives for `.env*`, credentials, private backups and unintended files before upload.

The backend deployment artifact excludes `database/` outside its folder; migrations need their own explicit artifact/job. Deployments must not depend on DDL files that never reach the target or on startup silently creating the schema.

## 9. Phase G — domain and TLS

Use Azure's actual frontend `defaultHostName` for a CNAME. For the `pragathiews.org` DNS zone the record label is normally `stage.edu`; if the DNS provider manages a delegated `edu.pragathiews.org` zone, use `stage`. Add the corresponding `asuid.stage.edu` (or delegated-zone `asuid.stage`) TXT value shown by Azure. Bind `stage.edu.pragathiews.org` to the **stage frontend**, provision a supported TLS certificate and validate HTTPS. Do not alter the existing `edu` production binding. [Microsoft custom domain guide](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain).

The optional API custom hostname needs its own CNAME, verification, app binding and certificate. Using the actual default Azure HTTPS API hostname initially is sufficient. Update API public URLs, portal URL, CORS, frontend upstream, certificate verification links and any sandbox callback together. Validate redirects, cookies and link generation on the custom domain, not only the Azure default address. [Microsoft certificate guide](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-certificate?tabs=apex).

## 10. Phase H — branch-bound CI/CD

Recommended deliverables: explicit `backend-stage.yml` and `admin-stage.yml`, plus dev equivalents if hosted, or a carefully validated reusable workflow with unambiguous caller mappings. Do not use a default target that falls back to production.

For each deploy job:

- Bind the GitHub environment (`stage` / `development` / `production`). Configure allowed deployment branches in GitHub and scope credentials to that environment's resources.
- Add a ref guard covering push and manual dispatch. Example stage job condition: `if: github.ref == 'refs/heads/stage'`; production must check `refs/heads/main`.
- Use separate concurrency groups such as `stage-backend-azure` and `stage-admin-azure`; prevent an in-progress deployment from being canceled half way. Coordinate any workflows sharing a target.
- Include source, workflow, deployment-tool and relevant DB/migration paths in triggers. Migration-only changes must run the appropriate gate, even if the backend code is unchanged.
- Keep PR checks credential-free. Do not expose deployment secrets to untrusted fork PRs or use unchecked PR code in privileged deployment jobs.
- Backend: install dev requirements, run isolated tests, package only backend source, verify excluded secret paths, deploy after tests/migration gates, then run real post-deploy smoke checks.
- Frontend: Linux Node 24, `npm ci`, typecheck/lint as required, build with SHA, assemble `.next/standalone` + `.next/static` + `public`, remove `.env*`, deploy, smoke-test custom-domain login and API proxy.
- Do not hardcode production publish profile names in stage workflows. Use dedicated stage/dev identity/profile; remove production-secret fallbacks from non-production jobs.
- Store immutable artifacts and record deployed SHA/environment. Choose retention sufficient for agreed rollback needs; current frontend retention of 7 days may be inadequate.

Prefer environment-scoped OIDC federation and least-privilege Azure deployment rights. Configure `id-token: write` only where needed and bind the federation subject to the intended GitHub environment. If retaining publish profiles initially, use distinct profiles for each app/environment, keep them secret, and validate publishing authentication settings. [Microsoft GitHub Actions deployment guide](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid).

Do not inject DB credentials into GitHub jobs unless a scoped migration/SQL acceptance step actually needs them. Runtime secrets remain on the appropriate App Services/vault. Changes to runtime configuration need validation even when code artifacts are identical.

## 11. Phase I — migration and rollback lifecycle

Implement an explicit SQL Server-compatible migration runner/artifact, with ordered versions, applied-version tracking, target validation, one migration lock, failure logging and tested rollback/recovery procedures. Review existing `tools/migrate.py` and `apply_schema.py`: their PostgreSQL-oriented behavior is not a ready Azure SQL runner.

For each release: back up/check recovery point → rehearse migration in stage → apply additive/backward-compatible DDL where possible → deploy compatible API/frontend → validate data plane → enable any intentionally tested side effects. Coordinate backend and frontend when contracts change; the current independent workflows provide no atomic cross-service release.

Rollback: identify last accepted artifact/SHA and configuration snapshot, redeploy known compatible code, and verify flows. A code rollback does not undo schema/data changes. For incompatible data changes use the rehearsed forward-fix/restore path, with a separate target restoration and controlled cutover. Do not automatically copy `edu_stage` over production or promote sanitized stage data. Re-running an old workflow can use current settings and dependencies; retaining and redeploying known artifacts is stronger evidence of a reproducible rollback.

## 12. Phase J — mobile environment parity

For **both** Flutter projects:

1. Provide explicit `API_BASE_URL` and `ALLOW_INSECURE_HTTP=false` for hosted stage/dev and all release builds. `allowInsecureHttp` currently defaults true, so do not rely on README HTTPS claims.
2. Add stage/dev flavors or separate identifiers and visible display names for side-by-side installation. Confirm Android applicationId, iOS bundle ID, signing, URL schemes, secure-storage keys and any keychain groups are independent.
3. Register separate stage/dev Firebase apps/projects and use their native config/build defines. Existing Android defaults point to the production Firebase project; changing only the API URL does not isolate push.
4. Remove copied production device registrations server-side and prove logout unregisters the right environment. Test notifications on physical Android/iOS devices; emulator/widget tests do not prove APNs/FCM delivery.
5. Test staff OTP, family setup, session refresh, role restore, linked-child boundaries, uploads, PDF/download/share, camera/audio permissions where used and sandbox payment resumption.
6. Store signing credentials securely and produce clearly labeled stage artifacts through a controlled distribution channel. Do not replace the production app/store release while testing stage.

Local-only backend may use `local-json`/local files for fast work, but SQL Server staging checks remain necessary. Android emulator host access is `10.0.2.2:8010`; physical devices need a reachable development host. Allow HTTP only through an explicit debug-only setup and document that it is not the hosted/release policy.

## 13. Acceptance criteria and evidence

Do not mark setup complete merely because resources exist or `/health` returns 200. `/health` reports selected adapters, not DB/Blob connectivity. Save sanitized results in `docs/environments/VALIDATION.md` with timestamp, resource/environment, deployed SHA, steps and result.

- [ ] Production resource/DNS/config baseline captured; production remains functional.
- [ ] `stage` deploys only stage; `develop` deploys only development if hosted; `main` alone can deploy production, including manual runs.
- [ ] Only one authoritative frontend pipeline per target; workflow and GitHub environment restrictions agree.
- [ ] API SQL query confirms `edu_stage` / `devdb`; runtime credential cannot read/write the production database.
- [ ] Schema/version/constraints agree with the selected release and startup has no missing-table/column errors.
- [ ] SQL/Blob/reference data are coherent and sanitized; copied tokens/OTPs/devices are gone.
- [ ] JWT/signing/deploy/provider credentials are independent, absent from packages/logs/source.
- [ ] Login page, same-origin proxy, staff OTP and family setup work with controlled recipients.
- [ ] Wrong role/client, unrelated child and unauthorized file requests are denied.
- [ ] Enrollment, fees/receipt, deposit proof/review, academics, attendance, assignment and certificate flows pass.
- [ ] Role/account changes, pending change acceptance/rejection and session revocation pass.
- [ ] Test upload/download affects only non-production storage; anonymous access is denied.
- [ ] Reminders and delivery boundaries cannot reach real students/parents; payment flow is unset or sandboxed.
- [ ] Custom-domain DNS, certificate, redirects, public links and cookies work.
- [ ] Both mobile apps use non-production API/Firebase/session namespaces and HTTPS.
- [ ] Backend tests, relevant SQL tests, frontend checks/representative browser tests and Flutter checks have recorded results; failures are explained without weakening authorization.
- [ ] Restore/rollback rehearsal completed in non-production with code/schema/config compatibility documented.
- [ ] Owner/access/cost/backup/monitoring inventory and operator instructions are complete.

Isolation proof should include a uniquely named staging test record/file, verified absent from production through authorized read-only inspection, plus credential-level denial of production access. Do not issue speculative production writes to test isolation. Capture email/push sandbox evidence without storing OTP values or real PII.

## 14. Required final implementation deliverables

1. Reviewed branch/environment-specific workflow changes, with manual-ref guards and overlapping workflow resolution.
2. Environment-aware config generator, placeholder templates, target/secret-leak validation and tests for rejection paths.
3. Idempotent infrastructure instructions/IaC and a sanitized actual-resource inventory.
4. SQL schema provisioning/migration artifacts, sanitized test seeding and safe refresh procedure.
5. Separate storage and credential setup, recipient safety controls and sandbox callback instructions.
6. DNS/TLS record instructions with actual stage host verification details delivered through appropriate private channels.
7. Mobile flavor/build/distribution instructions and tested non-production configurations.
8. Smoke/acceptance results, deployment SHAs/artifacts, recovery procedure and a list of genuine remaining blockers.

### Paste-ready task for the next Codex session

> Read `docs/PROJECT_HANDOVER.md`, `docs/PROJECT_INVENTORY.md` and `docs/STAGE_AND_DEVELOPMENT_CODEX_INSTRUCTIONS.md`. Implement the isolated staging environment requested here: branch `stage`, Azure SQL database `edu_stage`, separate backend and frontend App Services, private non-production Blob storage, domain `stage.edu.pragathiews.org`, branch-bound CI/CD and independent secrets. Treat `stage_appservice` as a logical label and choose a valid available Azure app name. Also prepare the independent development environment using the documented proposed `develop`/`devdb` convention, resolving existing repository conventions first. Discover actual production resource settings before using historic examples. Preserve production on `main`, audit duplicate frontend workflows and manual dispatch guards, sanitize any copied data and sessions, and contain email/push/SMS/payment side effects before startup. Make settings generation and migrations explicitly environment-aware, update both Flutter projects for isolated builds, run the acceptance criteria and write actual-resource/validation/rollback documentation. Do not report any cloud step as complete without evidence. Continue through all authorized implementation and verification work; clearly identify missing external access or decisions that prevent completion.
