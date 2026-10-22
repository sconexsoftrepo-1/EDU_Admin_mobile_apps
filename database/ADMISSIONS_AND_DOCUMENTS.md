# Admission lifecycle and document collection

This checklist separates the database foundation from the future UI/API workflow. The current web admission screens remain browser-based demonstrations; the new document workflow is specified and guarded in SQL, not a working server-backed upload service.

## Flow and records

| Stage | Information to capture | Records and checks |
| --- | --- | --- |
| Enquiry | Candidate and parent contact, requested course/campus, reference/social/walk-in/website source, campaign/referrer, communication consent, assigned counsellor and next follow-up | admission_sources, admission_enquiries, enquiry_followups, admission_cycles |
| Draft application | Application number, course/year/category, name, DOB, gender, contacts, structured address, enquiry/source link and submission consent | admission_applications; new applications start as draft |
| Family contacts | Names, relationships, phones, emails, occupation, address and one primary guardian | application_guardians; at most one primary guardian per application |
| Prior education | Institution, board/university, qualification, registration number, passing year, result status and score scale | application_qualifications; scores must not exceed a supplied maximum |
| Document receipt | Configured course/year/category checklist, document type, original filename, private storage key, MIME, byte size, SHA-256, received date/employee and revision | document_types, program_document_requirements, admission_documents; allowed types and size checked |
| Document review | Pending/verified/rejected/waived state, reviewer/time, reason, expiry and original-sighting evidence | document_verification_events recorded automatically; terminal review needs a reviewer/time; waiver needs reason |
| Eligibility review | Review decision and explanation | admission_reviews; an eligible review and passed qualification are required before offer/acceptance/enrollment |
| Offer | Offer number, offered course, issuing employee, issue/accept-by dates, terms and acceptance | admission_offers; explicit issued/accepted offer required for corresponding application transitions |
| Student creation | Permanent student/admission numbers, profile, emergency contact, family links, assigned course/cohort/year/semester/section/roll number | students, parents, student_parents, batches, semesters, sections, student_enrollments |
| Enrollment | Accepted application, matching student/course/year/section and authorizing employee | admission_enrollment_events; required enrollment documents must be verified or explicitly waived under policy |
| Evidence carry-forward | Admission document references retained for the enrolled student | student_document_links; cross-student links rejected |
| Fees and receipts | Approved schedule, installments, internal/external heads, scholarship allocation, payment, receipt and allocation | fee_structures, student_fee_charges, fee_adjustments, student_scholarships, charge_scholarship_allocations, payments, receipts, payment_allocations |
| Relieving | Approved reason/date, academic/financial/hostel clearances and resulting status | students.relieved_on/relieving_reason, student_status_history; detailed clearance rules remain a service workflow |

Permitted states: draft → submitted → reviewing (or documents_pending) → verified → offered → accepted → enrolled. Rejection and withdrawal are explicitly allowed from appropriate intermediate states. Arbitrary skipping, reopening terminal records or directly creating an enrolled application is rejected. Submit may precede full document verification; the stage-specific checklist determines what must be verified before offer and enrollment.

## Document checklist to confirm with management

The institution must approve the checklist for each course, academic year, admission category and collection stage. These are candidate categories, not a claim that all are mandatory:

- Student photograph and proof of date of birth.
- Qualifying marksheets, pass certificate and board/university registration details.
- Transfer/school-leaving certificate and conduct certificate, where applicable.
- Migration or equivalency/eligibility certificate for relevant boards/universities or transfer admissions.
- Entrance examination result/allotment letter where that admission route requires it.
- Student and guardian identity/address evidence only when required by the approved admission process.
- Scholarship application, award letter, and category/income or other eligibility evidence only for the relevant scheme and authorized purpose.
- Parent/guardian declarations, emergency contacts, communication consent and required admission undertakings.
- Lateral-entry/transfer prior-study records only for those categories.
- Hostel undertaking and approved pickup/guardian authorization only for hostel residents.

Record whether an original was sighted, by whom and when; retain a verified copy/reference according to the college's approved policy rather than assuming originals are retained. Record re-uploaded evidence as a new revision. Verified file identifiers/hashes cannot be replaced in place. Rejection, original sighting and waiver permissions require authenticated staff actions in the future backend.

## Before production

Approve mandatory versus optional documents and waiver authorities. Add file-content scanning and private storage. Implement duplicate identity review, age/eligibility and academic-year consistency, guardian permissions, capacity/intake controls, applicable seat allocation, portal invitations, acknowledgments, fees and cancellation/refund rules. Test a real management-approved application, a missing-document case, rejection/re-upload, scholarship admission, transfer admission and relieving. Never fabricate or infer collected documents from the current browser demo.
