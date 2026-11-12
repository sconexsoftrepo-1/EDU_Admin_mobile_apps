# Deploying EduNexa to Azure App Service

Two Linux web apps on one App Service plan, next to the Azure SQL database:

| Web app | Folder | Runtime | Startup command | Health check |
|---|---|---|---|---|
| Backend API | `backend/` | Python 3.12 | `sh startup.sh` | `/health` |
| Admin dashboard | `admin-dashboard/` | Node 22 LTS | `node server.js` | `/portal/login` |

The database is `edupragathi.database.windows.net` / `edu-dev` (resource group **Pragathi**,
region **Southeast Asia**). Create the plan and both web apps in **the same region** as the database:
the API makes many database calls per page, so it must be next to it.

## 1. Create the plan and the two web apps (portal, once)

1. **App Service plans → + Create**: resource group `Pragathi`, name `asp-edunexa`, **Linux**, region
   **Southeast Asia**, pricing plan **Premium v3 P1v3** (P0v3 or B2 for testing).
2. **App Services → + Create → Web App**: name e.g. `edunexa-api-pragathi`, publish **Code**, runtime
   **Python 3.12**, Linux, Southeast Asia, plan `asp-edunexa`. Leave deployment and monitoring as they are.
3. Same again for the dashboard: name e.g. `edunexa-admin-pragathi`, runtime **Node 22 LTS**, same plan.
4. Azure SQL server `edupragathi` → **Networking** → tick **Allow Azure services and resources to
   access this server** → Save (the API connects from Azure; your own IP stays for tools).

Note the two addresses, e.g. `https://edunexa-api-pragathi.azurewebsites.net` and
`https://edunexa-admin-pragathi.azurewebsites.net`.

## 2. Build the settings and the packages (this Mac)

```bash
cd "/Users/sconex.ios.dev/Leads porjects/edunexa-college"
backend/.venv/bin/python deploy/azure/make_backend_settings.py \
  --api-url https://edunexa-api-pragathi.azurewebsites.net \
  --admin-url https://edunexa-admin-pragathi.azurewebsites.net
bash deploy/azure/package.sh          # makes out/backend.zip and out/admin.zip
```

Everything lands in `deploy/azure/out/` (git-ignored; `backend-appsettings.json` holds passwords and
keys — never commit or share it in chat).

## 3. Deploy

**With the Azure CLI** (fastest; signed in as an Owner of the client's subscription):

```bash
az login
az account set --subscription fa7aff08-db6d-4b24-bb39-95dff95cf969
RG=Pragathi API_APP=edunexa-api-pragathi ADMIN_APP=edunexa-admin-pragathi bash deploy/azure/deploy.sh
```

It sets the app settings, startup commands, Always On, HTTPS only, TLS 1.2 and the health check,
uploads both zips, then calls `/health` and the login page.

**Or in the portal**, per web app:

- *Settings → Environment variables → Advanced edit*: paste `out/backend-appsettings.json` (API).
  Dashboard: `EDUNEXA_API_URL=<API address>`, `NODE_ENV=production`, `HOSTNAME=0.0.0.0`,
  `PORT=8080`, `WEBSITES_PORT=8080`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- *Settings → Configuration → General settings*: startup command (table above), **Always on = On**,
  HTTPS only = On, minimum TLS 1.2.
- *Monitoring → Health check*: enable with the path in the table.
- *Deployment Center* is not needed: deploy the zip with
  `az webapp deploy -g Pragathi -n <app> --src-path deploy/azure/out/<zip> --type zip`.

## 4. After the first deploy

1. Open `https://<API address>/health` → `{"status":"ok","storage":"sqlserver",…}`.
2. Open `https://<admin address>/portal/login` and sign in as **Pragathi Admin**.
3. Mobile apps: build with `--dart-define=API_BASE_URL=https://<API address>` (they still default to
   the old server `http://150.241.246.34:8010`) and install the new builds.
4. Custom domains (optional): web app → *Custom domains* → add `api.<domain>` / `admin.<domain>` →
   *App Service Managed Certificate*; then rerun step 2 and 3 with the new addresses.
5. *Logs*: web app → *Log stream*, or `az webapp log tail -g Pragathi -n <app>`.

## Things to know

- **One instance for the API.** The hourly fee-reminder job runs inside the API process: scale the plan
  **up** (bigger size), never **out** (more instances), or reminders are sent twice.
- **Serverless database pauses.** `edu-dev` is General Purpose *Serverless* with a 1-hour auto-pause:
  after a quiet hour the first request waits about a minute (error 40613) while it wakes. For live use
  switch it to **Standard S2** (database → *Compute + storage*) — cheaper when always on, and no pauses.
- **Secrets live only in App Service settings** (and `backend/.env` / `backend/secrets/` on this Mac):
  the database password, JWT secret, S3 keys, Firebase key (`EDUNEXA_FCM_SERVICE_ACCOUNT_JSON`) and the
  certificate signing key. Keep `backend/secrets/certificate-signing-key.txt` safe: certificates
  issued on Azure are verified with it.
- **Files** (photos, documents, receipts, bank slips) go to the private Azure Blob container `edu`
  (folder `uploads/`) once `backend/.env` has `EDUNEXA_FILE_STORAGE=azure`,
  `EDUNEXA_AZURE_STORAGE_ACCOUNT=<storage account name>` and `EDUNEXA_AZURE_STORAGE_KEY=<key1>`
  (storage account → *Security + networking → Access keys*). Rerun `make_backend_settings.py` after
  changing them. Keep the container **private**: the dashboard and apps show and download files
  through the API's signed-in links, never public URLs.
- **Redeploying**: change code → `bash deploy/azure/package.sh` → `deploy.sh` (or `az webapp deploy`).
