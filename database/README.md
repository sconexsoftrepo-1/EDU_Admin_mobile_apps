# EduNexa database, revision 2

The complete `edunexa_schema.sql` now defines 126 tables: the previous 94 plus 32 additions. It also defines student charge balances, student outstanding/overdue totals by currency, certificate download totals, cashbook movements and daily finance views.

## Installation

For a fresh PostgreSQL 16+ database: `psql -v ON_ERROR_STOP=1 -d edunexa -f edunexa_schema.sql`.

For an existing database created from the original 94-table schema: back it up, test on a copy, then apply `migrations/002_admissions_finance_admin.sql` once. Do not apply this migration after installing the new full schema; it is already included. These scripts are intentionally not rerunnable migration runners.

The migrated baseline's financial classifications need reviewed backfill: pre-existing fee heads default to internal, and pre-existing expenses default to unpaid. An approved expense must not be treated as a settled cash payment. Configure external parties, fees, document checklists and admission sources before starting new admissions.

## Added coverage

- Enquiry sources and follow-up history; admission cycles; application guardians and qualifications; eligibility reviews; offers; controlled application status transitions; enrollment linkage; student lifecycle history.
- Document types with file restrictions; course/year/category/stage checklists; received documents, revisions, private file keys, hashes, original sighting, verification, rejection, waivers and append-only review history. Admission documents remain linked to the resulting student.
- Internal versus external fee ownership, external parties/remittances, installments, charge-level scholarships, refunds, gateway order/event metadata, parent fee reminders and delivery attempts.
- Certificate signature metadata and download events; employee tax-document storage metadata including Form 16; Admin app preferences; private report export jobs/download events; hostel provision issues and pickup/return details.
- JSON staging fields preserve the expanded client Excel rows until explicit mappings and additional operational policy fields are implemented.

## Important boundaries

This is a single-institution, multi-campus foundation. It is not tenant-isolated SaaS. SQL money is in major currency units, with currency retained in finance views. The older web demo stores amounts in paise; convert explicitly. The native Admin sample stores major INR units.

No Python API, payment provider, SMS delivery, cryptographic signing, document scanning, or report-storage integration was implemented. `backend/` is empty. SQL tables provide persistence structure; they do not connect themselves to the web preview or Flutter app.

The future service must enforce identity/campus permissions, role-scoped projections, authenticated downloads, signed storage access, file MIME/content scanning, provider signature verification, consent, retention, reliable jobs, tax/payroll policy and approvals. Do not embed sensitive access tokens or raw credentials in JSON fields. Use a least-privilege application database role. Set transaction-local `edunexa.actor_user_code` and `edunexa.change_reason` for attributable admission/student status history; SQL does not authenticate those settings.

Remaining service checks include cross-campus ownership, full course capacity/intake, legal guardianship/consent rules, scholar eligibility JSON, aggregate charge overpayments and account credits, accounting-period closing, refund authorization, historical reversals, and edits to underlying finance master records. The included guards cover tested invariants, not every college-specific policy.

## Verification

The full schema and upgrade from the original baseline executed in PGlite, a local PostgreSQL-compatible engine. Eighteen business checks exercised admission, document verification, protected evidence/history, payment and scholarship allocation guards, refunds and independent balance reconciliation. See VALIDATION_REPORT.json. A deployed PostgreSQL 16+ server and concurrent production load were not tested.
