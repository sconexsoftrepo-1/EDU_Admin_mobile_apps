# Client data collection and import

Give the client `EduNexa_Client_Data.xlsx`. Each entity sheet has exact machine-readable headers in row 1 and blank entry rows starting at row 2. Required fields are shown in gold. The Field Guide identifies types, required columns and relationship keys. The Examples sheet contains fictional records for guidance only and is never imported. Add rows below the prepared area for larger datasets.

Enter teachers AND non-teaching staff in Employees first, then enter Teachers or Staff extension rows using `employee_code`. A parent with two children needs one Parents record and two Student Parents relationship rows. A student's program, batch and semester resolve through Enrollments -> Sections -> Batches/Programs and Semesters. Do not create duplicate parent records for siblings. Use permanent codes that remain stable across uploads. Do not collect passwords or authentication tokens through Excel.

Future Python import service contract:
1. Accept only authorized .xlsx uploads with size and row limits. Ignore Instructions, Field Guide and Examples. Treat unknown sheets or headers as errors. Never execute workbook formulas, macros or external links; reject formula cells in data sheets.
2. Read all sheets, skip blank rows, require exact row-1 headers, validate required fields, dates, numbers, enums, Yes/No values and code uniqueness. Resolve references against both earlier sheets and existing database records. Import in the order in import-contract.json.
3. Show a dry-run preview and downloadable errors with sheet, Excel row, column, supplied value and reason. No writes when validation fails. Validate business relationships listed in database/README.md.
4. Default to create-only. Existing codes are conflicts. Allow explicit reviewed update mode; blanks must not silently erase stored fields. Preserve 0 amounts, leading-zero phone numbers, postal codes and identifiers.
5. Require a reviewed commit action. Write the whole approved upload in one transaction, with idempotency based on the file hash and import mode. Commit or roll back all entity rows. Persist failed job diagnostics outside the rolled-back entity transaction.
6. Record import_jobs/import_rows and audit events. Restrict raw upload/error downloads, set a retention policy, and map rows to authenticated campus scope rather than trusting uploaded campus codes.

The workbook is a collection template, not a working XLSX import feature. The existing demo portal is not connected to this schema. These specifications are ready for the later Python backend work.
