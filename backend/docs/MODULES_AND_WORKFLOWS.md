# Modules and workflows

## File convention

A resource screen such as `app/modules/finance/fee_structures/` has:

- `api.py`: route functions and active `query_list`, `query_get`, `query_save`, `query_delete` functions; injected query adapter used by the service.
- `schemas.py`: typed create/update request models derived from the bundled catalog.
- `service.py`: business-rule service using the shared validator and the screen's query adapter.
- `__init__.py`: Python package marker.

No SQL file or unused SQL string is included. SQL connectivity is disabled. The active local query functions can later be replaced with parameterized SQL inside the same `api.py`, preserving the endpoint/query proximity requested.

Shared code lives in `app/core/`; catalog contracts in `app/contracts/`. `app/workflows/schemas.py` contains typed transaction requests shared by workflow screens. Sensitive security resources use dedicated APIs in `access_control/authentication`, `access_control/role_management`, and `access_control/forms`, rather than generic CRUD. Transaction screens put their workflow logic, queries and routes together in `finance/transactions/api.py`, `admissions/enrollment/api.py`, and `hostel/permissions_workflow/api.py`.

## Suggested data-entry order

1. Institution → campus → departments, academic years, programs, batches, semesters, sections and subjects.
2. Employees → teacher/staff profiles, salary components, leave types; parent details when pre-imported.
3. Fee heads and external parties → fee structures and scholarships.
4. Admission sources/cycles and document types → program document requirements.
5. Admission enquiries/followups → applications, guardian details, qualifications and document metadata.
6. Authorized review → enrollment → student fee charges → scholarship/discount → collection and receipt → reports.
7. Hostels → rooms → beds → allocations → leave/pickup permissions.

Foreign-key-like references are checked against current local records. Missing dependencies return 422. `code` identifiers are generated when omitted. List endpoints support `offset` and `limit` (maximum 200). Updates use PATCH. Retained/immutable records reject deletion or editing with 409. Managed finance/security records have no generic mutation endpoints.

## Admissions

Application status is entered through its resource screen. Enrollment requires `verified` or `accepted` status, a matching program/academic-year section, free section capacity, a unique roll number, a primary guardian and verified required documents. Requirements for submission/offer/enrollment and category `all` are included. Permitted waivers count only where the configured requirement allows them.

Document review uses `/admissions/documents/{code}/review`; verification checks the storage reference, SHA-256, expiry and original-sighting requirements. The API records metadata and review audit; it does not upload or inspect document binaries. Student fields in the enrollment request are validated against the student schema. Enrollment atomically creates the student, parent links, enrollment, document links and status history. A failure rolls back all changes.

## Accounts and finance

- `GET /finance/students/{code}/ledger`: gross charge/tax, discounts, scholarships, net paid and outstanding per charge and student.
- `POST /finance/adjustments`: approved discount/waiver, capped by outstanding balance.
- `POST /finance/scholarships/approve`: capped allocations to eligible fee heads for the same student.
- `POST /finance/collect`: manual cash/bank-transfer/cheque recording with a required `Idempotency-Key` header. Repeated identical requests return the same payment/receipt; a reused key with a changed payload returns 409. Overpayments, student/currency mismatch, duplicate non-cash references and invalid precision are rejected.
- `GET /finance/summary`: collection totals and balances, internal versus external ownership, recorded expenses and remittances.
- `GET /finance/ledger-export.csv`: download with export permission and audit event.
- `GET /finance/cashbook`: cash receipts, optional ISO-date range. Expense payment-mode and comprehensive cash-book reconciliation remain pending.

Financial calculations use decimal arithmetic, not floating point. INR is the implemented transaction currency. A record in the local cash/bank collection API is a manual bookkeeping entry, not a payment-gateway confirmation or bank settlement. External integration endpoints reject requests until configured.

## Forms

`POST /forms` creates a definition bound to a known screen; PUT revises it. Fields support text/email/phone/integer/decimal/date/boolean/select/textarea, required flags, section names, help text and array ordering. Submissions require the current revision; previous submissions retain their original definition. Forms with submissions can be unpublished but not deleted. These forms store custom submissions separately; they do not alter SQL schema or automatically modify existing app forms.

## Mobile and infrastructure

Mobile responses derive the student/parent/employee identity from the authenticated session. Generic resource access is staff-only. Admin mobile requires an admin client and report permission. Integration readiness is visible through `/integrations/status`.

Module resource coverage includes academic setup/teaching, student/parent records, HR/leave/payroll metadata, accounts, admissions, hostel, library, transport, inventory, placements, communications, reports and import metadata. Resource CRUD is a foundation; it is not a claim that every specialized lifecycle or third-party delivery workflow is complete. See README integration status and the generated endpoint inventory for the actual supported operations.
