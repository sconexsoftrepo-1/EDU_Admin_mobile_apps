#!/bin/sh
# Azure App Service (Linux, Python 3.12) startup command:  sh startup.sh
# One worker on purpose: the hourly fee-reminder job and some locks live inside the process, so
# scale the App Service plan UP (bigger size), not OUT (more instances).
PY=python
[ -x .venv/bin/python ] && PY=.venv/bin/python   # local test run; App Service provides python
exec "$PY" -m uvicorn app.asgi:app \
  --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 \
  --proxy-headers --forwarded-allow-ips="*" --timeout-keep-alive 75
