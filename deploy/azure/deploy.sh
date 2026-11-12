#!/bin/bash
# Configure and deploy both App Service web apps with the Azure CLI (run from the repo root).
#
#   az login                                   # with the account that has Owner on the client's subscription
#   az account set --subscription fa7aff08-db6d-4b24-bb39-95dff95cf969
#   RG=Pragathi API_APP=<backend web app name> ADMIN_APP=<dashboard web app name> bash deploy/azure/deploy.sh [backend|admin]
#   (no argument = both; "backend" needs only RG and API_APP; "admin" needs API_APP too, to point the
#   dashboard at the API)
#
# Needs: the two web apps already created (see README.md), deploy/azure/out/backend-appsettings.json
# (make_backend_settings.py) and the zips (package.sh).
set -euo pipefail
: "${RG:?set RG to the resource group}" "${API_APP:?set API_APP}"
OUT="$(cd "$(dirname "$0")" && pwd)/out"
WHAT="${1:-all}"
API_URL="https://$(az webapp show -g "$RG" -n "$API_APP" --query defaultHostName -o tsv)"
echo "API:   $API_URL"
if [[ "$WHAT" != "backend" ]]; then
  : "${ADMIN_APP:?set ADMIN_APP}"
  ADMIN_URL="https://$(az webapp show -g "$RG" -n "$ADMIN_APP" --query defaultHostName -o tsv)"
  echo "Admin: $ADMIN_URL"
fi

if [[ "$WHAT" == "all" || "$WHAT" == "backend" ]]; then
echo "== backend: settings, startup, deploy"
az webapp config appsettings set -g "$RG" -n "$API_APP" --settings @"$OUT/backend-appsettings.json" -o none
az webapp config set -g "$RG" -n "$API_APP" --startup-file "sh startup.sh" --always-on true \
  --http20-enabled true --min-tls-version 1.2 --ftps-state Disabled -o none
az webapp update -g "$RG" -n "$API_APP" --https-only true -o none
az webapp config set -g "$RG" -n "$API_APP" --generic-configurations '{"healthCheckPath": "/health"}' -o none
az webapp deploy -g "$RG" -n "$API_APP" --src-path "$OUT/backend.zip" --type zip --async false

fi

if [[ "$WHAT" == "all" || "$WHAT" == "admin" ]]; then
echo "== admin dashboard: settings, startup, deploy"
az webapp config appsettings set -g "$RG" -n "$ADMIN_APP" --settings \
  "EDUNEXA_API_URL=$API_URL" "NODE_ENV=production" "HOSTNAME=0.0.0.0" "PORT=8080" "WEBSITES_PORT=8080" \
  "SCM_DO_BUILD_DURING_DEPLOYMENT=false" "NEXT_TELEMETRY_DISABLED=1" -o none
az webapp config set -g "$RG" -n "$ADMIN_APP" --startup-file "node server.js" --always-on true \
  --http20-enabled true --min-tls-version 1.2 --ftps-state Disabled -o none
az webapp update -g "$RG" -n "$ADMIN_APP" --https-only true -o none
az webapp deploy -g "$RG" -n "$ADMIN_APP" --src-path "$OUT/admin.zip" --type zip --async false

fi

echo "== checks"
curl -fsS "$API_URL/health" && echo
[[ "$WHAT" == "backend" ]] || curl -fsS -o /dev/null -w "admin login page: HTTP %{http_code}\n" "$ADMIN_URL/portal/login"
