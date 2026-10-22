# EduNexa public website and admin dashboard

Complete existing source and public assets copied from the parent repository. Shared components and other showcase templates are retained to avoid breaking dependencies. The root URL opens EduNexa.

Run `npm ci` then `npm run dev -- --port 3010`. Open http://localhost:3010 for the college website. Admin login: http://localhost:3010/colleges-institutions/edunexa-college/portal/login . Run `npm run typecheck` and `npm run build` for validation.

The existing portal and mobile web previews use fictional data and browser-local storage. They are not connected to the SQL schema, a backend, or the new native Flutter apps. Existing CSV/demo import behavior is preserved; the client workbook requires the future Python import service described in ../client-data/initial-data-entry/import-contract-v2.json.

## Standalone college cleanup

This copy exposes EduNexa only. The second institute, its engineering catalog, dedicated components, theme, public assets and compatibility migration were removed. /colleges-institutions redirects to EduNexa. The post-login home/showcase strip, sidebar showcase link and global template switcher were removed; dashboard search, notifications, account menu and module navigation remain.
