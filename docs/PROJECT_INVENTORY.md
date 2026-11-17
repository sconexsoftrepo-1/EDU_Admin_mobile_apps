# Edu-Pragathi source inventory

Prepared: 18 November 2026. Baseline: `fb0b8926ed8a5fc85fc73063a01b8b8cd02053cb`.

Generated from checked-in JSON contracts and Python literal descriptors without importing the application, connecting to a database or reading secrets. Read with [the narrative handover](PROJECT_HANDOVER.md) and [environment instructions](STAGE_AND_DEVELOPMENT_CODEX_INSTRUCTIONS.md).

## 1. Counts and meaning

- 141 resource contracts in `backend/app/contracts/resources.json`.
- 98 web screen descriptors in `backend/app/contracts/screens.json`.
- 14 navigation module hubs in `backend/app/contracts/module_hubs.json`.
- Two independent Flutter projects, four main mobile client policies and one web policy.
- 73 main mobile client/screen descriptors, plus clerk and lab-specific replacements listed below.

These counts are catalog sizes, not live table counts or a measured completion score. Permissions, merged/hidden routes, module hubs, dedicated code and account scope affect visible screens. Dedicated workspaces and integrations extend this catalog; it is not a complete HTTP route list. Some entries have `generic_api=false` and use dedicated workflows.

## 2. Navigation hubs

| Hub | Description | Screen keys |
|---|---|---|
| Admissions | Follow enquiries through applications, admissions and enrollment. | admissions, module-admissions |
| Academics | Manage courses, batches, teaching plans and academic progress. | course-setup, academics, teaching-staff, non-teaching-staff, labs, daily-labour, timetable, assignments, syllabus, calendar, module-academics |
| Finance & Fees | Record payments and receipts, keep the cashbook and clerk deposits, and manage fee ledgers, structures and scholarships. | payments, manual-payments, cashbook, late-fees, fees, fee-structures, scholarships |
| Student operations | Manage student records, enrollment, attendance and requests. | students, student-enrollment, attendance, student-leave, assessments, module-student_management |
| HR & payroll | Manage employees, attendance, leave and payroll. | employees, employee-attendance, employee-leave, salary-structures, payroll, payslips, bonuses, reimbursements, payroll-reports, module-human_resources |
| Procurement & expenses | Review expenses, purchasing, vendors and college assets. | expenses, invoices, expense-dashboard, purchase-requests, purchase-orders, vendors, equipment, utilities, maintenance, travel, transport-expenses, additional-expenses, inventory, assets, module-inventory |
| Transport & bus | Manage buses, routes, passengers and transport operations. | transport, buses, routes, route-stops, drivers, driver-allocation, student-allocation, faculty-allocation, bus-seating, trips, manifest, transport-attendance, vehicle-maintenance, fuel, transport-reports, module-transport |
| Certificates | Manage certificate requests, issuance and verification. | certificates, certificate-requests, module-certificates |
| Hostel | Manage rooms, beds, allocations and hostel permissions. | hostels, hostel-permissions, module-hostel |
| Communication | Manage announcements, notifications and communication campaigns. | notifications, payment-reminders, announcements, notification-templates, campaigns, module-communications |
| Reports | Find reports, downloads and the college audit trail. | reports, audit-logs, module-reports |
| Administration | Manage access, configuration, master data and documents. | accounts, credentials, roles, forms, imports, documents, settings, module-access_control, module-imports |
| Library | Manage library books, copies and loans. | module-library |
| Placements | Manage placement companies, drives and applications. | module-placements |

## 3. Web screen descriptors

| Key | Display title | Associated resources |
|---|---|---|
| campus-analytics | Campus analytics | students, employees, student_attendance |
| change-requests | Change requests | Dedicated permission/workflow |
| employees | Employee directory | employees, teachers, staff_profiles |
| employee-attendance | Employee attendance | employee_attendance |
| student-leave | Student leave | student_leave_requests |
| employee-leave | Leave management | leave_types, leave_requests |
| salary-structures | Salary structures | employee_salary_components |
| payroll | Payroll processing | payroll_runs, payslips, payslip_lines |
| payslips | Payslips | payslips, payslip_lines, employee_tax_documents |
| bonuses | Bonuses & incentives | payroll_adjustments |
| reimbursements | Reimbursements | payroll_adjustments |
| payroll-reports | Payroll reports | payroll_runs, payslips |
| expense-dashboard | Expense dashboard | expenses, college_invoices |
| purchase-requests | Purchase requests | purchase_requests |
| purchase-orders | Purchase orders | purchase_orders |
| vendors | Vendors | vendors |
| equipment | Equipment purchases | expenses, inventory_items |
| utilities | Utilities | expenses |
| maintenance | Maintenance | expenses |
| travel | Travel expenses | expenses |
| transport-expenses | Transport expenses | expenses |
| additional-expenses | Additional expenses | expenses |
| inventory | Inventory | inventory_items, inventory_movements |
| assets | Asset register | asset_register |
| transport | Transport dashboard | vehicles, transport_routes, transport_allocations |
| buses | Bus management | vehicles, vehicle_seats |
| routes | Bus routes | transport_routes |
| route-stops | Route stops | transport_stops |
| drivers | Driver management | employees |
| driver-allocation | Driver allocation | vehicles |
| student-allocation | Student allocation | transport_allocations, passenger_seats |
| faculty-allocation | Faculty allocation | passenger_seats |
| bus-seating | 3D bus seating | vehicle_seats, passenger_seats |
| trips | Daily trips | vehicle_trips |
| manifest | Passenger manifest | passenger_seats, transport_allocations |
| transport-attendance | Transport attendance | transport_attendance |
| vehicle-maintenance | Vehicle maintenance | vehicle_maintenance |
| fuel | Fuel records | vehicle_fuel |
| transport-reports | Transport reports | vehicle_trips, vehicle_fuel, vehicle_maintenance |
| accounts | Users & logins | Dedicated permission/workflow |
| credentials | Credential provisioning | Dedicated permission/workflow |
| campaigns | Notification campaigns | notification_campaigns |
| payment-reminders | Payment reminders | fee_reminder_jobs |
| announcements | Announcements | announcements, announcement_recipients |
| notification-templates | Notification templates | notification_templates |
| timetable | Timetable | timetable_slots, timetable_swap_requests, rooms |
| assignments | Assignments | assignments, assignment_submissions |
| assessments | Assessments | exams, exam_papers, exam_results |
| attendance | Student attendance | attendance_sessions, student_attendance |
| syllabus | Syllabus & resources | curriculum_subjects, learning_resources |
| calendar | Academic calendar | calendar_events |
| dashboard | Dashboard | students, admission_applications, payments, student_fee_charges |
| students | Students | students, parents, student_parents, student_enrollments, student_subjects, consents, student_status_history |
| admissions | Admissions | admission_enquiries, admission_sources, enquiry_followups, admission_cycles, admission_applications, application_guardians, application_qualifications, program_document_requirements, document_types, admission_documents, admission_offers, admission_reviews, admission_status_history, admission_enrollment_events |
| fees | Fees and finance | student_fee_charges, fee_heads, fee_structures, fee_adjustments, student_scholarships, charge_scholarship_allocations, external_parties |
| fee-structures | Fee structures | fee_heads, fee_structures, external_parties |
| payments | Payments | payments, payment_allocations, refunds, refund_allocations, payment_gateway_orders, payment_gateway_events, receipts |
| manual-payments | Manual payments screen | payments, receipts |
| late-fees | Late fee dues | student_fee_charges |
| receipts | Receipts | receipts |
| cashbook | Cash book | payments, expense_payment_entries, external_remittances, expenses |
| expenses | Expenses | expenses, expense_payment_entries |
| invoices | Invoices | college_invoices |
| scholarships | Scholarships | scholarships, student_scholarships, charge_scholarship_allocations |
| certificates | Certificates | certificates, certificate_signatures, certificate_download_events, certificate_types |
| certificate-requests | Certificate requests | certificate_requests |
| hostels | Hostels | hostels, hostel_rooms, hostel_beds, hostel_allocations, hostel_provision_issues |
| hostel-permissions | Hostel permissions | hostel_permissions |
| academics | Academic setup | academic_years, departments, programs, semesters, sections, subjects, curriculum_subjects, subject_offerings, rooms |
| roles | Roles and screen permissions | Dedicated permission/workflow |
| notifications | Notifications | notifications, notification_delivery_attempts |
| reports | Reports | report_export_jobs, report_download_events |
| audit-logs | Audit trail | Dedicated permission/workflow |
| settings | College settings | institutions, campuses, institution_settings |
| forms | Form builder | Dedicated permission/workflow |
| imports | Excel imports | import_jobs, import_rows |
| documents | Documents and Form 16 | documents, admission_documents, employee_tax_documents |
| module-academics | Academics setup | academic_years, assignment_submissions, assignments, attendance_sessions, calendar_events, campuses, curriculum_subjects, departments, exam_papers, exam_results, exams, institution_settings, institutions, learning_resources, programs, rooms, sections, semesters, subject_offerings, subjects, timetable_slots, timetable_swap_requests |
| module-access_control | Access Control setup | Dedicated permission/workflow |
| module-admissions | Admissions setup | admission_applications, admission_cycles, admission_documents, admission_enquiries, admission_enrollment_events, admission_offers, admission_reviews, admission_sources, admission_status_history, application_guardians, application_qualifications, document_types, document_verification_events, enquiry_followups, program_document_requirements, student_document_links |
| module-certificates | Certificates setup | certificate_download_events, certificate_requests, certificate_signatures, certificate_types, certificates |
| module-communications | Communications setup | announcement_recipients, announcements, contact_enquiries, device_tokens, grievances, message_threads, messages, notification_delivery_attempts, notifications, thread_members, notification_templates, notification_campaigns |
| module-finance | Finance setup | charge_scholarship_allocations, expenses, external_parties, external_remittances, fee_adjustments, fee_heads, fee_reminder_jobs, fee_structures, payment_allocations, payment_gateway_events, payment_gateway_orders, payments, receipts, refund_allocations, refunds, remittance_allocations, scholarships, student_fee_charges, student_scholarships, vendors, college_invoices, expense_payment_entries |
| module-hostel | Hostel setup | hostel_allocations, hostel_beds, hostel_permissions, hostel_provision_issues, hostel_rooms, hostels |
| module-human_resources | Human Resources setup | employee_attendance, employee_salary_components, employee_tax_documents, employees, leave_requests, leave_types, payroll_runs, payslip_lines, payslips, staff_profiles, teachers, payroll_adjustments |
| module-imports | Imports setup | import_jobs, import_rows |
| module-inventory | Inventory setup | inventory_items, inventory_movements, purchase_requests, purchase_orders, asset_register |
| module-library | Library setup | library_books, library_copies, library_loans |
| module-placements | Placements setup | placement_applications, placement_companies, placement_drives |
| module-reports | Reports setup | admin_mobile_preferences, report_download_events, report_export_jobs |
| module-student_management | Student Management setup | consents, documents, parents, student_attendance, student_enrollments, student_leave_requests, student_parents, student_status_history, student_subjects, students |
| module-transport | Transport setup | transport_allocations, transport_routes, transport_stops, vehicles, vehicle_trips, vehicle_maintenance, vehicle_fuel, vehicle_seats, passenger_seats, transport_attendance |
| course-setup | Courses & enrollment | programs, sections, student_enrollments, academic_years, departments, semesters, subjects, curriculum_subjects |
| student-enrollment | Student enrollment | students, parents, student_parents, documents |
| teaching-staff | Teaching staff onboarding | employees, teachers |
| non-teaching-staff | Non-teaching staff onboarding | employees, staff_profiles, employee_salary_components |
| labs | Labs & lab in-charges | staff_profiles, subject_offerings |
| daily-labour | Daily labour | employees, employee_salary_components |

Some hub keys are aliases or dedicated workspaces and do not appear as standalone descriptors above. Conversely, legacy setup descriptors can remain registered while the current navigation hides or merges them. See `admin-dashboard/src/lib/colleges/module-hubs.ts` and backend module-hub logic for runtime behavior.

## 4. Mobile descriptor inventory

Source: `backend/app/modules/mobile/workspace/api.py`. Runtime authorization may remove entries. Clerk/lab lists replace the appropriate staff workspace rather than representing new installable apps.

### admin-mobile (21 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| overview | Overview | summary |
| dues | Outstanding fees | student_fee_charges |
| reports | Finance reports | reports |
| activity | Activity and audit | audit |
| students | Students | students |
| admissions | Admissions | admission_applications |
| collections | Collections and receipts | payments |
| cash | Cash and clerk deposits | cash |
| cash-analytics | Collection analytics | fee_analytics |
| change-requests | Change requests | edit_requests |
| expenses | Expenditures | expenses |
| employees | Employees | employees |
| assessments | Assessments and marks | exams |
| academics | Academic progress | exam_results |
| assignments | Assignments and review | assignments |
| hostel | Hostel allocations | hostel_allocations |
| calendar | Calendar and events | calendar_events |
| certificates | Certificate approvals | certificates |
| announcements | Announcements | announcements |
| notifications | Notifications | notifications |
| profile | My profile | profile |

### parent-mobile (18 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| children | My children | students |
| profile | My profile | profile |
| fees | Fees and balances | fees |
| payments | Payments and receipts | payments |
| attendance | Attendance | student_attendance |
| leave | Student leave | student_leave_requests |
| results | Exam results | exam_results |
| timetable | Timetable | timetable_slots |
| assessments | Assessments and marks | exams |
| assignments | Assignments and performance | assignments |
| syllabus | Syllabus and resources | learning_resources |
| certificates | Certificates | certificates |
| hostel | Hostel and pickup permissions | hostel_permissions |
| transport | Bus and route | transport_allocations |
| calendar | Calendar and events | calendar_events |
| announcements | Announcements | announcements |
| messages | Teacher messages | messages |
| notifications | Notifications | notifications |

### student-mobile (18 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| profile | My profile | profile |
| timetable | Timetable | timetable_slots |
| attendance | Attendance | student_attendance |
| assessments | Assessments and marks | exams |
| assignments | Assignments and submissions | assignments |
| syllabus | Syllabus and resources | learning_resources |
| results | Exam results | exam_results |
| fees | Fees and balances | fees |
| payments | Payments and receipts | payments |
| certificates | Certificates | certificates |
| leave | Leave requests | student_leave_requests |
| library | Library loans | library_loans |
| hostel | Hostel permissions | hostel_permissions |
| transport | Bus and route | transport_allocations |
| calendar | Calendar and events | calendar_events |
| announcements | Announcements | announcements |
| messages | Messages | messages |
| notifications | Notifications | notifications |

### teacher-mobile (16 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| profile | My profile | profile |
| classes | Assigned classes | subject_offerings |
| timetable | Timetable and period swap | timetable_slots |
| attendance | Attendance entry | student_attendance |
| assessments | Assessments and marks | exams |
| assignments | Homework and assignments | assignments |
| submissions | Submissions and grading | assignment_submissions |
| syllabus | Syllabus progress and resources | learning_resources |
| results | Exam marks | exam_results |
| leave | Leave requests | leave_requests |
| payslips | Salary and payslips | payslips |
| tax-documents | Form 16 and tax documents | employee_tax_documents |
| calendar | Calendar and events | calendar_events |
| announcements | Announcements | announcements |
| messages | Messages | messages |
| notifications | Notifications | notifications |

### Cash clerk staff workspace (8 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| profile | My profile | profile |
| cash | Cash deposits | cash |
| leave | Leave requests | leave_requests |
| payslips | Salary and payslips | payslips |
| tax-documents | Form 16 and tax documents | employee_tax_documents |
| calendar | Calendar and events | calendar_events |
| announcements | Announcements | announcements |
| notifications | Notifications | notifications |

### Lab in-charge staff workspace (9 descriptors)

| Key | Title | Permission/resource descriptor |
|---|---|---|
| profile | My profile | profile |
| labs | My labs and sessions | lab_sessions |
| timetable | Lab timetable | lab_timetable |
| leave | Leave requests | leave_requests |
| payslips | Salary and payslips | payslips |
| tax-documents | Form 16 and tax documents | employee_tax_documents |
| calendar | Calendar and events | calendar_events |
| announcements | Announcements | announcements |
| notifications | Notifications | notifications |

## 5. Backend resource catalog by domain

Paths below come from `resources.json`; `generic_api` is a catalog flag, not a promise of unrestricted CRUD. Actual HTTP methods, write restrictions, authorization, examples and specialized transaction endpoints must be checked in route source/OpenAPI. Security/session records are handled by dedicated APIs.

### academics (24 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| academic_years | /api/v1/academics/academic-years | true |
| assignment_submissions | /api/v1/academics/assignment-submissions | true |
| assignments | /api/v1/academics/assignments | true |
| attendance_sessions | /api/v1/academics/attendance-sessions | true |
| batches | /api/v1/academics/batches | true |
| calendar_events | /api/v1/academics/calendar-events | true |
| campuses | /api/v1/academics/campuses | true |
| curriculum_subjects | /api/v1/academics/curriculum-subjects | true |
| departments | /api/v1/academics/departments | true |
| exam_papers | /api/v1/academics/exam-papers | true |
| exam_results | /api/v1/academics/exam-results | true |
| exams | /api/v1/academics/exams | true |
| institution_settings | /api/v1/academics/institution-settings | true |
| institutions | /api/v1/academics/institutions | true |
| learning_resources | /api/v1/academics/learning-resources | true |
| programs | /api/v1/academics/programs | true |
| rooms | /api/v1/academics/rooms | true |
| sections | /api/v1/academics/sections | true |
| semesters | /api/v1/academics/semesters | true |
| subject_offerings | /api/v1/academics/subject-offerings | true |
| subjects | /api/v1/academics/subjects | true |
| timetable_slots | /api/v1/academics/timetable-slots | true |
| website_pages | /api/v1/academics/website-pages | true |
| timetable_swap_requests | /api/v1/academics/timetable-swap-requests | true |

### access_control (8 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| audit_logs | /api/v1/access-control/audit-logs | false |
| password_reset_tokens | /api/v1/access-control/password-reset-tokens | false |
| permissions | /api/v1/access-control/permissions | false |
| refresh_tokens | /api/v1/access-control/refresh-tokens | false |
| role_permissions | /api/v1/access-control/role-permissions | false |
| roles | /api/v1/access-control/roles | false |
| user_roles | /api/v1/access-control/user-roles | false |
| users | /api/v1/access-control/users | false |

### admissions (16 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| admission_applications | /api/v1/admissions/admission-applications | true |
| admission_cycles | /api/v1/admissions/admission-cycles | true |
| admission_documents | /api/v1/admissions/admission-documents | true |
| admission_enquiries | /api/v1/admissions/admission-enquiries | true |
| admission_enrollment_events | /api/v1/admissions/admission-enrollment-events | true |
| admission_offers | /api/v1/admissions/admission-offers | true |
| admission_reviews | /api/v1/admissions/admission-reviews | true |
| admission_sources | /api/v1/admissions/admission-sources | true |
| admission_status_history | /api/v1/admissions/admission-status-history | true |
| application_guardians | /api/v1/admissions/application-guardians | true |
| application_qualifications | /api/v1/admissions/application-qualifications | true |
| document_types | /api/v1/admissions/document-types | true |
| document_verification_events | /api/v1/admissions/document-verification-events | true |
| enquiry_followups | /api/v1/admissions/enquiry-followups | true |
| program_document_requirements | /api/v1/admissions/program-document-requirements | true |
| student_document_links | /api/v1/admissions/student-document-links | true |

### certificates (5 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| certificate_download_events | /api/v1/certificates/certificate-download-events | true |
| certificate_requests | /api/v1/certificates/certificate-requests | true |
| certificate_signatures | /api/v1/certificates/certificate-signatures | true |
| certificate_types | /api/v1/certificates/certificate-types | true |
| certificates | /api/v1/certificates/certificates | true |

### communications (12 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| announcement_recipients | /api/v1/communications/announcement-recipients | true |
| announcements | /api/v1/communications/announcements | true |
| contact_enquiries | /api/v1/communications/contact-enquiries | true |
| device_tokens | /api/v1/communications/device-tokens | true |
| grievances | /api/v1/communications/grievances | true |
| message_threads | /api/v1/communications/message-threads | true |
| messages | /api/v1/communications/messages | true |
| notification_delivery_attempts | /api/v1/communications/notification-delivery-attempts | true |
| notifications | /api/v1/communications/notifications | true |
| thread_members | /api/v1/communications/thread-members | true |
| notification_templates | /api/v1/communications/notification-templates | true |
| notification_campaigns | /api/v1/communications/notification-campaigns | true |

### finance (22 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| charge_scholarship_allocations | /api/v1/finance/charge-scholarship-allocations | true |
| expenses | /api/v1/finance/expenses | true |
| external_parties | /api/v1/finance/external-parties | true |
| external_remittances | /api/v1/finance/external-remittances | true |
| fee_adjustments | /api/v1/finance/fee-adjustments | true |
| fee_heads | /api/v1/finance/fee-heads | true |
| fee_reminder_jobs | /api/v1/finance/fee-reminder-jobs | true |
| fee_structures | /api/v1/finance/fee-structures | true |
| payment_allocations | /api/v1/finance/payment-allocations | true |
| payment_gateway_events | /api/v1/finance/payment-gateway-events | true |
| payment_gateway_orders | /api/v1/finance/payment-gateway-orders | true |
| payments | /api/v1/finance/payments | true |
| receipts | /api/v1/finance/receipts | true |
| refund_allocations | /api/v1/finance/refund-allocations | true |
| refunds | /api/v1/finance/refunds | true |
| remittance_allocations | /api/v1/finance/remittance-allocations | true |
| scholarships | /api/v1/finance/scholarships | true |
| student_fee_charges | /api/v1/finance/student-fee-charges | true |
| student_scholarships | /api/v1/finance/student-scholarships | true |
| vendors | /api/v1/finance/vendors | true |
| college_invoices | /api/v1/finance/college-invoices | true |
| expense_payment_entries | /api/v1/finance/expense-payment-entries | true |

### hostel (6 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| hostel_allocations | /api/v1/hostel/hostel-allocations | true |
| hostel_beds | /api/v1/hostel/hostel-beds | true |
| hostel_permissions | /api/v1/hostel/hostel-permissions | true |
| hostel_provision_issues | /api/v1/hostel/hostel-provision-issues | true |
| hostel_rooms | /api/v1/hostel/hostel-rooms | true |
| hostels | /api/v1/hostel/hostels | true |

### human_resources (12 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| employee_attendance | /api/v1/human-resources/employee-attendance | true |
| employee_salary_components | /api/v1/human-resources/employee-salary-components | true |
| employee_tax_documents | /api/v1/human-resources/employee-tax-documents | true |
| employees | /api/v1/human-resources/employees | true |
| leave_requests | /api/v1/human-resources/leave-requests | true |
| leave_types | /api/v1/human-resources/leave-types | true |
| payroll_runs | /api/v1/human-resources/payroll-runs | true |
| payslip_lines | /api/v1/human-resources/payslip-lines | true |
| payslips | /api/v1/human-resources/payslips | true |
| staff_profiles | /api/v1/human-resources/staff-profiles | true |
| teachers | /api/v1/human-resources/teachers | true |
| payroll_adjustments | /api/v1/human-resources/payroll-adjustments | true |

### imports (2 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| import_jobs | /api/v1/imports/import-jobs | true |
| import_rows | /api/v1/imports/import-rows | true |

### inventory (5 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| inventory_items | /api/v1/inventory/inventory-items | true |
| inventory_movements | /api/v1/inventory/inventory-movements | true |
| purchase_requests | /api/v1/inventory/purchase-requests | true |
| purchase_orders | /api/v1/inventory/purchase-orders | true |
| asset_register | /api/v1/inventory/asset-register | true |

### library (3 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| library_books | /api/v1/library/library-books | true |
| library_copies | /api/v1/library/library-copies | true |
| library_loans | /api/v1/library/library-loans | true |

### placements (3 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| placement_applications | /api/v1/placements/placement-applications | true |
| placement_companies | /api/v1/placements/placement-companies | true |
| placement_drives | /api/v1/placements/placement-drives | true |

### reports (3 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| admin_mobile_preferences | /api/v1/reports/admin-mobile-preferences | true |
| report_download_events | /api/v1/reports/report-download-events | true |
| report_export_jobs | /api/v1/reports/report-export-jobs | true |

### student_management (10 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| consents | /api/v1/student-management/consents | true |
| documents | /api/v1/student-management/documents | true |
| parents | /api/v1/student-management/parents | true |
| student_attendance | /api/v1/student-management/student-attendance | true |
| student_enrollments | /api/v1/student-management/student-enrollments | true |
| student_leave_requests | /api/v1/student-management/student-leave-requests | true |
| student_parents | /api/v1/student-management/student-parents | true |
| student_status_history | /api/v1/student-management/student-status-history | true |
| student_subjects | /api/v1/student-management/student-subjects | true |
| students | /api/v1/student-management/students | true |

### transport (10 resources)

| Resource | Catalog path | Generic API flag |
|---|---|---|
| transport_allocations | /api/v1/transport/transport-allocations | true |
| transport_routes | /api/v1/transport/transport-routes | true |
| transport_stops | /api/v1/transport/transport-stops | true |
| vehicles | /api/v1/transport/vehicles | true |
| vehicle_trips | /api/v1/transport/vehicle-trips | true |
| vehicle_maintenance | /api/v1/transport/vehicle-maintenance | true |
| vehicle_fuel | /api/v1/transport/vehicle-fuel | true |
| vehicle_seats | /api/v1/transport/vehicle-seats | true |
| passenger_seats | /api/v1/transport/passenger-seats | true |
| transport_attendance | /api/v1/transport/transport-attendance | true |

## 6. Specialized code to inspect beyond the resource catalog

| Area | Source |
|---|---|
| Login / identity / OTP | `backend/app/modules/access_control/authentication/api.py`, `backend/app/core/security.py`, `otp_login.py`, `family_access.py` |
| Roles/accounts / approvals | `backend/app/modules/access_control/role_management/api.py`, `backend/app/core/edit_approvals.py` |
| Master data / enrollment | `backend/app/modules/master_data/onboarding/api.py`, `backend/app/modules/admissions/enrollment/api.py` |
| Fee plans, ledgers and custody | `backend/app/core/fee_plans.py`, `finance_ledger.py`, `fee_collection.py`, `cash_custody.py`, `late_fees.py` |
| Academic progress / curriculum | `backend/app/core/academic_progress.py`, `academic_sections.py`, `curriculum_workspace.py`, `course_form.py` |
| Teaching workspaces | `backend/app/core/attendance_workspace.py`, `assessment_workspace.py`, `assignment_workspace.py`, `syllabus_workspace.py`, `lab_workspace.py` |
| Timetable/calendar | `backend/app/core/timetable_templates.py`, `timetable_generator.py`, `calendar_workspace.py` |
| HR/payroll | `backend/app/core/hr_workspace.py`, `payroll_workspace.py` |
| Certificates/files | `backend/app/core/certificate_workspace.py`, `certificate_design.py`, `files.py`, `backend/app/modules/documents/files/api.py` |
| Chat and push | `backend/app/core/chat_workspace.py`, `push_api.py`, `push_delivery.py` |
| Email/providers | `backend/app/core/email_delivery.py`, `integrations_api.py` |
| Reports/export | `backend/app/core/analytics_workspace.py`, `excel_export.py`, `print_pdfs.py`, `backend/app/modules/reports/downloads/api.py` |

## 7. Existing verification source inventory

The following are source-file counts, not executed/passed test counts:

- `backend/tests`: 53 matching test files (`test_*.py`).
- `admin-dashboard/tests`: 21 matching test files (`*.spec.ts`).
- `mobile-apps/admin_teachers/test`: 18 matching test files (`*_test.dart`).
- `mobile-apps/parent_student/test`: 18 matching test files (`*_test.dart`).

Representative backend coverage files: `test_otp_login.py`, `test_family_access.py`, `test_login_administration.py`, `test_person_login_management.py`, `test_edit_approvals.py`, `test_azure_blob_files.py`, `test_fee_payments_and_cash.py`, `test_attendance_workspace.py`, `test_assessment_workspace.py`, `test_academic_progress.py`, `test_certificate_workspace_regressions.py`, `test_sqlserver_integration.py`.

Historical visual evidence: `docs/handover/2026-10-31/` and `docs/verification/2026-10-31/`. New product documentation should use freshly validated staging screenshots with fictional records.
