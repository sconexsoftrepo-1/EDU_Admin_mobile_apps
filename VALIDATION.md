# Validation

- Copied Next.js project: TypeScript check and production build passed using the installed parent workspace dependencies. Run npm ci for an independent installation.
- Parent, teacher and student Flutter projects: offline dependency resolution and flutter analyze passed with no issues. No device or release builds were run.
- Excel: all 44 sheets rendered and visually reviewed. Verified 41 import sheet header mappings, empty data rows, frozen headers, formatting and dropdowns in the exported workbook.
- SQL: verified 94 tables, reference targets and dependency order. A mechanically adapted SQLite copy executed successfully and rejected invalid foreign keys, duplicate codes and reversed date ranges. The original PostgreSQL SQL has not been executed on a PostgreSQL server.
- Backend directory is completely empty. No backend, XLSX import endpoint or database connection was implemented.

## Revised client Excel set (version 2)

13 workbooks, 24 focused data-entry tabs and 439 fields replace the old combined workbook for new collection. All exports reopened and their structure, blank inputs, formatting, validations, formulas and freeze panes checked. All sheets and header blocks visually reviewed from 109 rendered previews. Finance formula checks passed in the authoring engine. Native Microsoft Excel was not run. The original PostgreSQL schema is unchanged; expanded collection fields need explicit projections and migrations before import.
