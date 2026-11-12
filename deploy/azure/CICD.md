# CI/CD: push to `main` → Azure App Service (backend and admin dashboard)

The workflow `.github/workflows/backend-azure.yml` runs when a push to **main** changes anything in
`backend/` (or the workflow file). It:

1. runs the backend tests on GitHub (Python 3.12),
2. zips **only the `backend/` folder** (no tests, `.env`, secrets or virtual environment),
3. deploys the zip to the web app `edunexa-api-pragathi`; App Service installs `requirements.txt`
   and starts `sh startup.sh`,
4. calls `/health` until the new version answers.

Pushes that only touch `admin-dashboard/`, `mobile-apps/` or docs do **not** deploy the backend.
A failing test stops the deploy; the running version stays.

## One-time setup

### 1. Web app settings (once, from this Mac)

The pipeline deploys code only. Settings and secrets stay in the web app:

```bash
az login && az account set --subscription fa7aff08-db6d-4b24-bb39-95dff95cf969
backend/.venv/bin/python deploy/azure/make_backend_settings.py \
  --api-url https://edunexa-api-pragathi.azurewebsites.net \
  --admin-url https://edunexa-admin-pragathi.azurewebsites.net
az webapp config appsettings set -g Pragathi -n edunexa-api-pragathi --settings @deploy/azure/out/backend-appsettings.json -o none
az webapp config set -g Pragathi -n edunexa-api-pragathi --startup-file "sh startup.sh" --always-on true \
  --min-tls-version 1.2 --ftps-state Disabled -o none
az webapp update -g Pragathi -n edunexa-api-pragathi --https-only true -o none
az webapp config set -g Pragathi -n edunexa-api-pragathi --generic-configurations '{"healthCheckPath": "/health"}' -o none
```

(or `RG=Pragathi API_APP=edunexa-api-pragathi bash deploy/azure/deploy.sh backend`, which does the
same and also uploads a first zip). Rerun it only when `backend/.env` values change.

### 2. Allow the publish profile on the web app

Portal → web app `edunexa-api-pragathi` → **Settings → Configuration → General settings** →
**SCM Basic Auth Publishing Credentials = On** → **Save**.
(New web apps have it off; the publish profile does not work without it.)

### 3. Download the publish profile

Web app → **Overview** → **Download publish profile** (top toolbar). It is an XML file with the
deploy password: do not commit it or send it in chat.

### 4. Add it to GitHub

GitHub → repository **sconexsoftrepo-1/EDU_Admin_mobile_apps** → **Settings → Secrets and variables →
Actions → New repository secret**:

- Name: `AZURE_BACKEND_PUBLISH_PROFILE`
- Secret: the **entire contents** of the downloaded file (open it in a text editor, select all, paste)

### 5. Put the workflow on `main`

Commit `.github/workflows/backend-azure.yml` (and the backend changes) and merge to **main**. The
first push to main runs the pipeline. To run it by hand: GitHub → **Actions → Backend to Azure →
Run workflow**.

## Daily use

- Work on a branch → merge to `main` → GitHub **Actions** tab shows *Backend tests* then *Deploy to
  App Service* (about 8–12 minutes including Azure's package install).
- A red test run means nothing was deployed: open the run, fix, push again.
- If the health check fails after deploy: web app → **Monitoring → Log stream**.
- Roll back: GitHub → Actions → open an earlier successful run → **Re-run all jobs**.

## Why "root folder = backend"

App Service receives only what is inside `backend/` as its site root (`app/`, `requirements.txt`,
`startup.sh`, …), so it finds `requirements.txt` at the top and builds a Python app. The rest of the
repository (dashboard, mobile apps) never reaches the server.

If the publish profile is ever exposed: web app → **Overview → Reset publish profile**, download the
new one and update the GitHub secret.


---

# Admin dashboard pipeline

`.github/workflows/admin-azure.yml` runs when a push to **main** changes `admin-dashboard/`. It:

1. installs and builds the dashboard on GitHub (Node 24, Linux) — the build also type-checks the code,
2. packs the self-contained server (`.next/standalone` + static files + `public`) into a zip,
3. deploys it to `edunexa-admin-pragathi`, which runs `node server.js` (nothing is built on Azure),
4. checks that `/portal/login` answers.

Both pipelines are independent: a backend change deploys only the backend, a dashboard change only
the dashboard, a push that changes both runs both at the same time.

## One-time setup for the dashboard

1. **Create the web app**: App Services → + Create → Web App: name `edunexa-admin-pragathi`, publish
   **Code**, runtime **Node 24 LTS** (Node 22 LTS also works), Linux, region West US 3, the same B1 plan as the backend.
2. **Settings and startup command** (once, from the Mac, after the backend web app exists):

   ```bash
   bash deploy/azure/package.sh admin
   RG=Pragathi API_APP=edunexa-api-pragathi ADMIN_APP=edunexa-admin-pragathi bash deploy/azure/deploy.sh admin
   ```

   This sets `EDUNEXA_API_URL=https://edunexa-api-pragathi.azurewebsites.net` (the backend address),
   `NODE_ENV`, `HOSTNAME`, `PORT=8080`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, the startup command
   `node server.js`, Always On and HTTPS only, and uploads a first build.
   In the portal instead: web app → **Settings → Environment variables** (the values above) and
   **Configuration → General settings → Startup command** `node server.js`.
3. **SCM Basic Auth Publishing Credentials = On** (Configuration → General settings) → Save.
4. **Download publish profile** (Overview) → GitHub repository secret **`AZURE_ADMIN_PUBLISH_PROFILE`**
   (whole file contents).
5. Commit `.github/workflows/admin-azure.yml` and merge to **main**.

## Changing the backend address later

Web app `edunexa-admin-pragathi` → **Settings → Environment variables** → `EDUNEXA_API_URL` →
new address → **Apply** (the app restarts; no rebuild or redeploy needed). If the dashboard gets a new
address (custom domain), also add it to the backend: rerun `make_backend_settings.py` with the new
`--admin-url` and set the backend settings again.
