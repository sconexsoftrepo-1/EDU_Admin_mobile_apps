# Backend verification

- Python 3.14, FastAPI 0.159.1; isolated temporary local storage in tests.
- **23 automated tests passed.** Coverage includes JWT expiry/tampering, refresh rotation and reuse rejection, client binding, logout revocation, password changes, failed-login limits, live role edits, protected roles and assigned-role deletion, account disabling, credential non-disclosure, mobile student ownership, fee collection/idempotency/overpayment checks, scholarships/discounts/CSV, form revisions/validation/history, reference checks, admission document requirements, atomic enrollment/rollback, hostel departure/return, unconfigured integrations, request limits and every generated resource-list endpoint.
- OpenAPI generation passed; endpoint inventory was generated from the running app definition.
- Live Uvicorn HTTP smoke passed: health 200, protected resource 401, OpenAPI 200; server stopped after verification.
- Ruff import/undefined-name checks passed; all 519 Python files passed formatting checks.
- Runtime secrets/data/cache ignore rules verified.
- No remote SQL connectivity, migration, DDL or SQL writes were performed.
- Tests do not certify mobile/web UI integration, payment/SMS delivery, digital signatures, binary downloads, complete accounting or production security. Those are documented pending integrations.
- Test runner reports one upstream Starlette warning about future `httpx2` support; the current test suite passes with installed `httpx`.

Run: `python -m pytest -q` from `backend/`.
