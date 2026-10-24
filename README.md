# EduNexa College development package

- `admin-dashboard/`: complete copied Next.js template source and assets, including the public EduNexa website, ERP/admin dashboard and existing mobile web previews. Root opens EduNexa. Other showcase source is retained for shared dependencies.
- `backend/`: FastAPI backend with SQL Server persistence selected by its local `.env`. See `backend/README.md` for runtime and migration details.
- `mobile-apps/admin & teachers/`: Admin & Teachers Flutter app. `mobile-apps/parent & student mobile app/`: Parents & Students Flutter app. Both use role toggles at login, role-specific dashboards and their own authenticated API clients. See `mobile-apps/README.md`.
- `database/edunexa_schema_postgresql.sql`: the complete PostgreSQL schema (145 tables, keys, constraints, indexes, triggers and views) retained as the PostgreSQL migration source schema.
- `database/edunexa_schema_mysql.sql`: the same schema for MySQL 8.
- `client-data/initial-data-entry/`: 13 separate professional Excel collection files, with detailed fields, instructions and examples. A client-ready ZIP is in client-data/.
- `client-data/initial-data-entry/import-contract-v2.json`: expanded collection field contract and validation rules for future Python import development. Schema migrations and explicit field projections are still required.

Start the web copy using the commands in admin-dashboard/README.md. The two Flutter apps have setup instructions under `mobile-apps/` and use their own API clients with secure authentication.

Admin mobile web preview: `/colleges-institutions/edunexa-college/portal/admin/admin-app` after demo login. It uses the same browser records as the portal, with PDF/CSV report exports. The native apps load authorized records from the configured backend. Admission and document collection details are in `database/ADMISSIONS_AND_DOCUMENTS.md`.
