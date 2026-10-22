# EduNexa College development package

- `admin-dashboard/`: complete copied Next.js template source and assets, including the public EduNexa website, ERP/admin dashboard and existing mobile web previews. Root opens EduNexa. Other showcase source is retained for shared dependencies.
- `backend/`: intentionally empty, reserved for Python development.
- `mobile-apps/parent/`, `teacher/`, `student/`: Flutter starters. `mobile-apps/admin/`: a working local-data management demo with Overview, Dues, Reports and Activity. No native app is connected to the backend.
- `database/edunexa_schema.sql`: PostgreSQL schema with 126 tables, keys, constraints, indexes and timestamp triggers.
- `client-data/initial-data-entry/`: 13 separate professional Excel collection files, with detailed fields, instructions and examples. A client-ready ZIP is in client-data/.
- `client-data/initial-data-entry/import-contract-v2.json`: expanded collection field contract and validation rules for future Python import development. Schema migrations and explicit field projections are still required.

Start the web copy using the commands in admin-dashboard/README.md. Each Flutter app has its own setup instructions. No server, database, production authentication, XLSX upload endpoint or cross-app data sync has been implemented. The original repository source is preserved.

Admin mobile web preview: `/colleges-institutions/edunexa-college/portal/admin/admin-app` after demo login. It uses the same browser records as the portal, with PDF/CSV report exports. Native Admin uses independent fictional records. Admission and document collection details are in `database/ADMISSIONS_AND_DOCUMENTS.md`.
