# API endpoint inventory

Generated from the actual FastAPI OpenAPI contract. 572 operations across 276 paths.

Use `/docs` for request schemas and interactive authorization. Public routes are health, manifest and credential/refresh exchange; business data requires a bearer token and the route permissions.

| Module/screen | Method | Endpoint | Operation |
| --- | --- | --- | --- |
| API manifest | GET | `/api/v1/manifest` | Manifest |
| Academic Years | DELETE | `/api/v1/academics/academic-years/{code}` | Delete Record |
| Academic Years | GET | `/api/v1/academics/academic-years` | List Records |
| Academic Years | GET | `/api/v1/academics/academic-years/{code}` | Get Record |
| Academic Years | PATCH | `/api/v1/academics/academic-years/{code}` | Update Record |
| Academic Years | POST | `/api/v1/academics/academic-years` | Create Record |
| Admin Mobile Preferences | DELETE | `/api/v1/reports/admin-mobile-preferences/{code}` | Delete Record |
| Admin Mobile Preferences | GET | `/api/v1/reports/admin-mobile-preferences` | List Records |
| Admin Mobile Preferences | GET | `/api/v1/reports/admin-mobile-preferences/{code}` | Get Record |
| Admin Mobile Preferences | PATCH | `/api/v1/reports/admin-mobile-preferences/{code}` | Update Record |
| Admin Mobile Preferences | POST | `/api/v1/reports/admin-mobile-preferences` | Create Record |
| Admission Applications | DELETE | `/api/v1/admissions/admission-applications/{code}` | Delete Record |
| Admission Applications | GET | `/api/v1/admissions/admission-applications` | List Records |
| Admission Applications | GET | `/api/v1/admissions/admission-applications/{code}` | Get Record |
| Admission Applications | PATCH | `/api/v1/admissions/admission-applications/{code}` | Update Record |
| Admission Applications | POST | `/api/v1/admissions/admission-applications` | Create Record |
| Admission Cycles | DELETE | `/api/v1/admissions/admission-cycles/{code}` | Delete Record |
| Admission Cycles | GET | `/api/v1/admissions/admission-cycles` | List Records |
| Admission Cycles | GET | `/api/v1/admissions/admission-cycles/{code}` | Get Record |
| Admission Cycles | PATCH | `/api/v1/admissions/admission-cycles/{code}` | Update Record |
| Admission Cycles | POST | `/api/v1/admissions/admission-cycles` | Create Record |
| Admission Documents | DELETE | `/api/v1/admissions/admission-documents/{code}` | Delete Record |
| Admission Documents | GET | `/api/v1/admissions/admission-documents` | List Records |
| Admission Documents | GET | `/api/v1/admissions/admission-documents/{code}` | Get Record |
| Admission Documents | PATCH | `/api/v1/admissions/admission-documents/{code}` | Update Record |
| Admission Documents | POST | `/api/v1/admissions/admission-documents` | Create Record |
| Admission Enquiries | DELETE | `/api/v1/admissions/admission-enquiries/{code}` | Delete Record |
| Admission Enquiries | GET | `/api/v1/admissions/admission-enquiries` | List Records |
| Admission Enquiries | GET | `/api/v1/admissions/admission-enquiries/{code}` | Get Record |
| Admission Enquiries | PATCH | `/api/v1/admissions/admission-enquiries/{code}` | Update Record |
| Admission Enquiries | POST | `/api/v1/admissions/admission-enquiries` | Create Record |
| Admission Enrollment Events | GET | `/api/v1/admissions/admission-enrollment-events` | List Records |
| Admission Enrollment Events | GET | `/api/v1/admissions/admission-enrollment-events/{code}` | Get Record |
| Admission Offers | DELETE | `/api/v1/admissions/admission-offers/{code}` | Delete Record |
| Admission Offers | GET | `/api/v1/admissions/admission-offers` | List Records |
| Admission Offers | GET | `/api/v1/admissions/admission-offers/{code}` | Get Record |
| Admission Offers | PATCH | `/api/v1/admissions/admission-offers/{code}` | Update Record |
| Admission Offers | POST | `/api/v1/admissions/admission-offers` | Create Record |
| Admission Reviews | DELETE | `/api/v1/admissions/admission-reviews/{code}` | Delete Record |
| Admission Reviews | GET | `/api/v1/admissions/admission-reviews` | List Records |
| Admission Reviews | GET | `/api/v1/admissions/admission-reviews/{code}` | Get Record |
| Admission Reviews | PATCH | `/api/v1/admissions/admission-reviews/{code}` | Update Record |
| Admission Reviews | POST | `/api/v1/admissions/admission-reviews` | Create Record |
| Admission Sources | DELETE | `/api/v1/admissions/admission-sources/{code}` | Delete Record |
| Admission Sources | GET | `/api/v1/admissions/admission-sources` | List Records |
| Admission Sources | GET | `/api/v1/admissions/admission-sources/{code}` | Get Record |
| Admission Sources | PATCH | `/api/v1/admissions/admission-sources/{code}` | Update Record |
| Admission Sources | POST | `/api/v1/admissions/admission-sources` | Create Record |
| Admission Status History | GET | `/api/v1/admissions/admission-status-history` | List Records |
| Admission Status History | GET | `/api/v1/admissions/admission-status-history/{code}` | Get Record |
| Admissions workflows | POST | `/api/v1/admissions/applications/{code}/enroll` | Enroll |
| Admissions workflows | POST | `/api/v1/admissions/documents/{code}/review` | Review Document |
| Announcement Recipients | DELETE | `/api/v1/communications/announcement-recipients/{code}` | Delete Record |
| Announcement Recipients | GET | `/api/v1/communications/announcement-recipients` | List Records |
| Announcement Recipients | GET | `/api/v1/communications/announcement-recipients/{code}` | Get Record |
| Announcement Recipients | PATCH | `/api/v1/communications/announcement-recipients/{code}` | Update Record |
| Announcement Recipients | POST | `/api/v1/communications/announcement-recipients` | Create Record |
| Announcements | DELETE | `/api/v1/communications/announcements/{code}` | Delete Record |
| Announcements | GET | `/api/v1/communications/announcements` | List Records |
| Announcements | GET | `/api/v1/communications/announcements/{code}` | Get Record |
| Announcements | PATCH | `/api/v1/communications/announcements/{code}` | Update Record |
| Announcements | POST | `/api/v1/communications/announcements` | Create Record |
| Application Guardians | DELETE | `/api/v1/admissions/application-guardians/{code}` | Delete Record |
| Application Guardians | GET | `/api/v1/admissions/application-guardians` | List Records |
| Application Guardians | GET | `/api/v1/admissions/application-guardians/{code}` | Get Record |
| Application Guardians | PATCH | `/api/v1/admissions/application-guardians/{code}` | Update Record |
| Application Guardians | POST | `/api/v1/admissions/application-guardians` | Create Record |
| Application Qualifications | DELETE | `/api/v1/admissions/application-qualifications/{code}` | Delete Record |
| Application Qualifications | GET | `/api/v1/admissions/application-qualifications` | List Records |
| Application Qualifications | GET | `/api/v1/admissions/application-qualifications/{code}` | Get Record |
| Application Qualifications | PATCH | `/api/v1/admissions/application-qualifications/{code}` | Update Record |
| Application Qualifications | POST | `/api/v1/admissions/application-qualifications` | Create Record |
| Assignment Submissions | DELETE | `/api/v1/academics/assignment-submissions/{code}` | Delete Record |
| Assignment Submissions | GET | `/api/v1/academics/assignment-submissions` | List Records |
| Assignment Submissions | GET | `/api/v1/academics/assignment-submissions/{code}` | Get Record |
| Assignment Submissions | PATCH | `/api/v1/academics/assignment-submissions/{code}` | Update Record |
| Assignment Submissions | POST | `/api/v1/academics/assignment-submissions` | Create Record |
| Assignments | DELETE | `/api/v1/academics/assignments/{code}` | Delete Record |
| Assignments | GET | `/api/v1/academics/assignments` | List Records |
| Assignments | GET | `/api/v1/academics/assignments/{code}` | Get Record |
| Assignments | PATCH | `/api/v1/academics/assignments/{code}` | Update Record |
| Assignments | POST | `/api/v1/academics/assignments` | Create Record |
| Attendance Sessions | DELETE | `/api/v1/academics/attendance-sessions/{code}` | Delete Record |
| Attendance Sessions | GET | `/api/v1/academics/attendance-sessions` | List Records |
| Attendance Sessions | GET | `/api/v1/academics/attendance-sessions/{code}` | Get Record |
| Attendance Sessions | PATCH | `/api/v1/academics/attendance-sessions/{code}` | Update Record |
| Attendance Sessions | POST | `/api/v1/academics/attendance-sessions` | Create Record |
| Authentication | GET | `/api/v1/auth/me` | Me |
| Authentication | POST | `/api/v1/auth/change-password` | Change Password |
| Authentication | POST | `/api/v1/auth/login` | Login |
| Authentication | POST | `/api/v1/auth/logout` | Logout |
| Authentication | POST | `/api/v1/auth/logout-all` | Logout All |
| Authentication | POST | `/api/v1/auth/refresh` | Refresh |
| Batches | DELETE | `/api/v1/academics/batches/{code}` | Delete Record |
| Batches | GET | `/api/v1/academics/batches` | List Records |
| Batches | GET | `/api/v1/academics/batches/{code}` | Get Record |
| Batches | PATCH | `/api/v1/academics/batches/{code}` | Update Record |
| Batches | POST | `/api/v1/academics/batches` | Create Record |
| Calendar Events | DELETE | `/api/v1/academics/calendar-events/{code}` | Delete Record |
| Calendar Events | GET | `/api/v1/academics/calendar-events` | List Records |
| Calendar Events | GET | `/api/v1/academics/calendar-events/{code}` | Get Record |
| Calendar Events | PATCH | `/api/v1/academics/calendar-events/{code}` | Update Record |
| Calendar Events | POST | `/api/v1/academics/calendar-events` | Create Record |
| Campuses | DELETE | `/api/v1/academics/campuses/{code}` | Delete Record |
| Campuses | GET | `/api/v1/academics/campuses` | List Records |
| Campuses | GET | `/api/v1/academics/campuses/{code}` | Get Record |
| Campuses | PATCH | `/api/v1/academics/campuses/{code}` | Update Record |
| Campuses | POST | `/api/v1/academics/campuses` | Create Record |
| Certificate Download Events | GET | `/api/v1/certificates/certificate-download-events` | List Records |
| Certificate Download Events | GET | `/api/v1/certificates/certificate-download-events/{code}` | Get Record |
| Certificate Requests | DELETE | `/api/v1/certificates/certificate-requests/{code}` | Delete Record |
| Certificate Requests | GET | `/api/v1/certificates/certificate-requests` | List Records |
| Certificate Requests | GET | `/api/v1/certificates/certificate-requests/{code}` | Get Record |
| Certificate Requests | PATCH | `/api/v1/certificates/certificate-requests/{code}` | Update Record |
| Certificate Requests | POST | `/api/v1/certificates/certificate-requests` | Create Record |
| Certificate Signatures | GET | `/api/v1/certificates/certificate-signatures` | List Records |
| Certificate Signatures | GET | `/api/v1/certificates/certificate-signatures/{code}` | Get Record |
| Certificate Types | DELETE | `/api/v1/certificates/certificate-types/{code}` | Delete Record |
| Certificate Types | GET | `/api/v1/certificates/certificate-types` | List Records |
| Certificate Types | GET | `/api/v1/certificates/certificate-types/{code}` | Get Record |
| Certificate Types | PATCH | `/api/v1/certificates/certificate-types/{code}` | Update Record |
| Certificate Types | POST | `/api/v1/certificates/certificate-types` | Create Record |
| Certificates | GET | `/api/v1/certificates/certificates` | List Records |
| Certificates | GET | `/api/v1/certificates/certificates/{code}` | Get Record |
| Charge Scholarship Allocations | GET | `/api/v1/finance/charge-scholarship-allocations` | List Records |
| Charge Scholarship Allocations | GET | `/api/v1/finance/charge-scholarship-allocations/{code}` | Get Record |
| Configurable forms | DELETE | `/api/v1/forms/{code}` | Delete |
| Configurable forms | GET | `/api/v1/forms` | Listing |
| Configurable forms | GET | `/api/v1/forms/{code}` | Detail |
| Configurable forms | GET | `/api/v1/forms/{code}/submissions` | Submissions |
| Configurable forms | POST | `/api/v1/forms` | Create |
| Configurable forms | POST | `/api/v1/forms/{code}/submissions` | Submit |
| Configurable forms | PUT | `/api/v1/forms/{code}` | Update |
| Consents | DELETE | `/api/v1/student-management/consents/{code}` | Delete Record |
| Consents | GET | `/api/v1/student-management/consents` | List Records |
| Consents | GET | `/api/v1/student-management/consents/{code}` | Get Record |
| Consents | PATCH | `/api/v1/student-management/consents/{code}` | Update Record |
| Consents | POST | `/api/v1/student-management/consents` | Create Record |
| Contact Enquiries | DELETE | `/api/v1/communications/contact-enquiries/{code}` | Delete Record |
| Contact Enquiries | GET | `/api/v1/communications/contact-enquiries` | List Records |
| Contact Enquiries | GET | `/api/v1/communications/contact-enquiries/{code}` | Get Record |
| Contact Enquiries | PATCH | `/api/v1/communications/contact-enquiries/{code}` | Update Record |
| Contact Enquiries | POST | `/api/v1/communications/contact-enquiries` | Create Record |
| Curriculum Subjects | DELETE | `/api/v1/academics/curriculum-subjects/{code}` | Delete Record |
| Curriculum Subjects | GET | `/api/v1/academics/curriculum-subjects` | List Records |
| Curriculum Subjects | GET | `/api/v1/academics/curriculum-subjects/{code}` | Get Record |
| Curriculum Subjects | PATCH | `/api/v1/academics/curriculum-subjects/{code}` | Update Record |
| Curriculum Subjects | POST | `/api/v1/academics/curriculum-subjects` | Create Record |
| Departments | DELETE | `/api/v1/academics/departments/{code}` | Delete Record |
| Departments | GET | `/api/v1/academics/departments` | List Records |
| Departments | GET | `/api/v1/academics/departments/{code}` | Get Record |
| Departments | PATCH | `/api/v1/academics/departments/{code}` | Update Record |
| Departments | POST | `/api/v1/academics/departments` | Create Record |
| Device Tokens | DELETE | `/api/v1/communications/device-tokens/{code}` | Delete Record |
| Device Tokens | GET | `/api/v1/communications/device-tokens` | List Records |
| Device Tokens | GET | `/api/v1/communications/device-tokens/{code}` | Get Record |
| Device Tokens | PATCH | `/api/v1/communications/device-tokens/{code}` | Update Record |
| Device Tokens | POST | `/api/v1/communications/device-tokens` | Create Record |
| Document Types | DELETE | `/api/v1/admissions/document-types/{code}` | Delete Record |
| Document Types | GET | `/api/v1/admissions/document-types` | List Records |
| Document Types | GET | `/api/v1/admissions/document-types/{code}` | Get Record |
| Document Types | PATCH | `/api/v1/admissions/document-types/{code}` | Update Record |
| Document Types | POST | `/api/v1/admissions/document-types` | Create Record |
| Document Verification Events | GET | `/api/v1/admissions/document-verification-events` | List Records |
| Document Verification Events | GET | `/api/v1/admissions/document-verification-events/{code}` | Get Record |
| Documents | DELETE | `/api/v1/student-management/documents/{code}` | Delete Record |
| Documents | GET | `/api/v1/student-management/documents` | List Records |
| Documents | GET | `/api/v1/student-management/documents/{code}` | Get Record |
| Documents | PATCH | `/api/v1/student-management/documents/{code}` | Update Record |
| Documents | POST | `/api/v1/student-management/documents` | Create Record |
| Employee Attendance | DELETE | `/api/v1/human-resources/employee-attendance/{code}` | Delete Record |
| Employee Attendance | GET | `/api/v1/human-resources/employee-attendance` | List Records |
| Employee Attendance | GET | `/api/v1/human-resources/employee-attendance/{code}` | Get Record |
| Employee Attendance | PATCH | `/api/v1/human-resources/employee-attendance/{code}` | Update Record |
| Employee Attendance | POST | `/api/v1/human-resources/employee-attendance` | Create Record |
| Employee Salary Components | DELETE | `/api/v1/human-resources/employee-salary-components/{code}` | Delete Record |
| Employee Salary Components | GET | `/api/v1/human-resources/employee-salary-components` | List Records |
| Employee Salary Components | GET | `/api/v1/human-resources/employee-salary-components/{code}` | Get Record |
| Employee Salary Components | PATCH | `/api/v1/human-resources/employee-salary-components/{code}` | Update Record |
| Employee Salary Components | POST | `/api/v1/human-resources/employee-salary-components` | Create Record |
| Employee Tax Documents | DELETE | `/api/v1/human-resources/employee-tax-documents/{code}` | Delete Record |
| Employee Tax Documents | GET | `/api/v1/human-resources/employee-tax-documents` | List Records |
| Employee Tax Documents | GET | `/api/v1/human-resources/employee-tax-documents/{code}` | Get Record |
| Employee Tax Documents | PATCH | `/api/v1/human-resources/employee-tax-documents/{code}` | Update Record |
| Employee Tax Documents | POST | `/api/v1/human-resources/employee-tax-documents` | Create Record |
| Employees | DELETE | `/api/v1/human-resources/employees/{code}` | Delete Record |
| Employees | GET | `/api/v1/human-resources/employees` | List Records |
| Employees | GET | `/api/v1/human-resources/employees/{code}` | Get Record |
| Employees | PATCH | `/api/v1/human-resources/employees/{code}` | Update Record |
| Employees | POST | `/api/v1/human-resources/employees` | Create Record |
| Enquiry Followups | DELETE | `/api/v1/admissions/enquiry-followups/{code}` | Delete Record |
| Enquiry Followups | GET | `/api/v1/admissions/enquiry-followups` | List Records |
| Enquiry Followups | GET | `/api/v1/admissions/enquiry-followups/{code}` | Get Record |
| Enquiry Followups | PATCH | `/api/v1/admissions/enquiry-followups/{code}` | Update Record |
| Enquiry Followups | POST | `/api/v1/admissions/enquiry-followups` | Create Record |
| Exam Papers | DELETE | `/api/v1/academics/exam-papers/{code}` | Delete Record |
| Exam Papers | GET | `/api/v1/academics/exam-papers` | List Records |
| Exam Papers | GET | `/api/v1/academics/exam-papers/{code}` | Get Record |
| Exam Papers | PATCH | `/api/v1/academics/exam-papers/{code}` | Update Record |
| Exam Papers | POST | `/api/v1/academics/exam-papers` | Create Record |
| Exam Results | DELETE | `/api/v1/academics/exam-results/{code}` | Delete Record |
| Exam Results | GET | `/api/v1/academics/exam-results` | List Records |
| Exam Results | GET | `/api/v1/academics/exam-results/{code}` | Get Record |
| Exam Results | PATCH | `/api/v1/academics/exam-results/{code}` | Update Record |
| Exam Results | POST | `/api/v1/academics/exam-results` | Create Record |
| Exams | DELETE | `/api/v1/academics/exams/{code}` | Delete Record |
| Exams | GET | `/api/v1/academics/exams` | List Records |
| Exams | GET | `/api/v1/academics/exams/{code}` | Get Record |
| Exams | PATCH | `/api/v1/academics/exams/{code}` | Update Record |
| Exams | POST | `/api/v1/academics/exams` | Create Record |
| Expenses | DELETE | `/api/v1/finance/expenses/{code}` | Delete Record |
| Expenses | GET | `/api/v1/finance/expenses` | List Records |
| Expenses | GET | `/api/v1/finance/expenses/{code}` | Get Record |
| Expenses | PATCH | `/api/v1/finance/expenses/{code}` | Update Record |
| Expenses | POST | `/api/v1/finance/expenses` | Create Record |
| External Parties | DELETE | `/api/v1/finance/external-parties/{code}` | Delete Record |
| External Parties | GET | `/api/v1/finance/external-parties` | List Records |
| External Parties | GET | `/api/v1/finance/external-parties/{code}` | Get Record |
| External Parties | PATCH | `/api/v1/finance/external-parties/{code}` | Update Record |
| External Parties | POST | `/api/v1/finance/external-parties` | Create Record |
| External Remittances | GET | `/api/v1/finance/external-remittances` | List Records |
| External Remittances | GET | `/api/v1/finance/external-remittances/{code}` | Get Record |
| Fee Adjustments | GET | `/api/v1/finance/fee-adjustments` | List Records |
| Fee Adjustments | GET | `/api/v1/finance/fee-adjustments/{code}` | Get Record |
| Fee Heads | DELETE | `/api/v1/finance/fee-heads/{code}` | Delete Record |
| Fee Heads | GET | `/api/v1/finance/fee-heads` | List Records |
| Fee Heads | GET | `/api/v1/finance/fee-heads/{code}` | Get Record |
| Fee Heads | PATCH | `/api/v1/finance/fee-heads/{code}` | Update Record |
| Fee Heads | POST | `/api/v1/finance/fee-heads` | Create Record |
| Fee Reminder Jobs | DELETE | `/api/v1/finance/fee-reminder-jobs/{code}` | Delete Record |
| Fee Reminder Jobs | GET | `/api/v1/finance/fee-reminder-jobs` | List Records |
| Fee Reminder Jobs | GET | `/api/v1/finance/fee-reminder-jobs/{code}` | Get Record |
| Fee Reminder Jobs | PATCH | `/api/v1/finance/fee-reminder-jobs/{code}` | Update Record |
| Fee Reminder Jobs | POST | `/api/v1/finance/fee-reminder-jobs` | Create Record |
| Fee Structures | DELETE | `/api/v1/finance/fee-structures/{code}` | Delete Record |
| Fee Structures | GET | `/api/v1/finance/fee-structures` | List Records |
| Fee Structures | GET | `/api/v1/finance/fee-structures/{code}` | Get Record |
| Fee Structures | PATCH | `/api/v1/finance/fee-structures/{code}` | Update Record |
| Fee Structures | POST | `/api/v1/finance/fee-structures` | Create Record |
| Finance workflows | GET | `/api/v1/finance/cashbook` | Cashbook |
| Finance workflows | GET | `/api/v1/finance/ledger-export.csv` | Export |
| Finance workflows | GET | `/api/v1/finance/students/{code}/ledger` | Ledger |
| Finance workflows | GET | `/api/v1/finance/summary` | Summary |
| Finance workflows | POST | `/api/v1/finance/adjustments` | Adjust |
| Finance workflows | POST | `/api/v1/finance/collect` | Collect |
| Finance workflows | POST | `/api/v1/finance/scholarships/approve` | Approve Scholarship |
| Grievances | DELETE | `/api/v1/communications/grievances/{code}` | Delete Record |
| Grievances | GET | `/api/v1/communications/grievances` | List Records |
| Grievances | GET | `/api/v1/communications/grievances/{code}` | Get Record |
| Grievances | PATCH | `/api/v1/communications/grievances/{code}` | Update Record |
| Grievances | POST | `/api/v1/communications/grievances` | Create Record |
| Health | GET | `/health` | Health |
| Hostel Allocations | DELETE | `/api/v1/hostel/hostel-allocations/{code}` | Delete Record |
| Hostel Allocations | GET | `/api/v1/hostel/hostel-allocations` | List Records |
| Hostel Allocations | GET | `/api/v1/hostel/hostel-allocations/{code}` | Get Record |
| Hostel Allocations | PATCH | `/api/v1/hostel/hostel-allocations/{code}` | Update Record |
| Hostel Allocations | POST | `/api/v1/hostel/hostel-allocations` | Create Record |
| Hostel Beds | DELETE | `/api/v1/hostel/hostel-beds/{code}` | Delete Record |
| Hostel Beds | GET | `/api/v1/hostel/hostel-beds` | List Records |
| Hostel Beds | GET | `/api/v1/hostel/hostel-beds/{code}` | Get Record |
| Hostel Beds | PATCH | `/api/v1/hostel/hostel-beds/{code}` | Update Record |
| Hostel Beds | POST | `/api/v1/hostel/hostel-beds` | Create Record |
| Hostel Permissions | DELETE | `/api/v1/hostel/hostel-permissions/{code}` | Delete Record |
| Hostel Permissions | GET | `/api/v1/hostel/hostel-permissions` | List Records |
| Hostel Permissions | GET | `/api/v1/hostel/hostel-permissions/{code}` | Get Record |
| Hostel Permissions | PATCH | `/api/v1/hostel/hostel-permissions/{code}` | Update Record |
| Hostel Permissions | POST | `/api/v1/hostel/hostel-permissions` | Create Record |
| Hostel Provision Issues | DELETE | `/api/v1/hostel/hostel-provision-issues/{code}` | Delete Record |
| Hostel Provision Issues | GET | `/api/v1/hostel/hostel-provision-issues` | List Records |
| Hostel Provision Issues | GET | `/api/v1/hostel/hostel-provision-issues/{code}` | Get Record |
| Hostel Provision Issues | PATCH | `/api/v1/hostel/hostel-provision-issues/{code}` | Update Record |
| Hostel Provision Issues | POST | `/api/v1/hostel/hostel-provision-issues` | Create Record |
| Hostel Rooms | DELETE | `/api/v1/hostel/hostel-rooms/{code}` | Delete Record |
| Hostel Rooms | GET | `/api/v1/hostel/hostel-rooms` | List Records |
| Hostel Rooms | GET | `/api/v1/hostel/hostel-rooms/{code}` | Get Record |
| Hostel Rooms | PATCH | `/api/v1/hostel/hostel-rooms/{code}` | Update Record |
| Hostel Rooms | POST | `/api/v1/hostel/hostel-rooms` | Create Record |
| Hostel workflows | POST | `/api/v1/hostel/permissions/{code}/approve` | Hostel Approve |
| Hostel workflows | POST | `/api/v1/hostel/permissions/{code}/depart` | Hostel Depart |
| Hostel workflows | POST | `/api/v1/hostel/permissions/{code}/return` | Hostel Return |
| Hostels | DELETE | `/api/v1/hostel/hostels/{code}` | Delete Record |
| Hostels | GET | `/api/v1/hostel/hostels` | List Records |
| Hostels | GET | `/api/v1/hostel/hostels/{code}` | Get Record |
| Hostels | PATCH | `/api/v1/hostel/hostels/{code}` | Update Record |
| Hostels | POST | `/api/v1/hostel/hostels` | Create Record |
| Import Jobs | DELETE | `/api/v1/imports/import-jobs/{code}` | Delete Record |
| Import Jobs | GET | `/api/v1/imports/import-jobs` | List Records |
| Import Jobs | GET | `/api/v1/imports/import-jobs/{code}` | Get Record |
| Import Jobs | PATCH | `/api/v1/imports/import-jobs/{code}` | Update Record |
| Import Jobs | POST | `/api/v1/imports/import-jobs` | Create Record |
| Import Rows | DELETE | `/api/v1/imports/import-rows/{code}` | Delete Record |
| Import Rows | GET | `/api/v1/imports/import-rows` | List Records |
| Import Rows | GET | `/api/v1/imports/import-rows/{code}` | Get Record |
| Import Rows | PATCH | `/api/v1/imports/import-rows/{code}` | Update Record |
| Import Rows | POST | `/api/v1/imports/import-rows` | Create Record |
| Institution Settings | DELETE | `/api/v1/academics/institution-settings/{code}` | Delete Record |
| Institution Settings | GET | `/api/v1/academics/institution-settings` | List Records |
| Institution Settings | GET | `/api/v1/academics/institution-settings/{code}` | Get Record |
| Institution Settings | PATCH | `/api/v1/academics/institution-settings/{code}` | Update Record |
| Institution Settings | POST | `/api/v1/academics/institution-settings` | Create Record |
| Institutions | DELETE | `/api/v1/academics/institutions/{code}` | Delete Record |
| Institutions | GET | `/api/v1/academics/institutions` | List Records |
| Institutions | GET | `/api/v1/academics/institutions/{code}` | Get Record |
| Institutions | PATCH | `/api/v1/academics/institutions/{code}` | Update Record |
| Institutions | POST | `/api/v1/academics/institutions` | Create Record |
| Integration readiness | GET | `/api/v1/integrations/status` | Status |
| Integration readiness | POST | `/api/v1/integrations/certificates/sign` | Sign |
| Integration readiness | POST | `/api/v1/integrations/payments/order` | Order |
| Integration readiness | POST | `/api/v1/integrations/sms/send` | Sms |
| Inventory Items | DELETE | `/api/v1/inventory/inventory-items/{code}` | Delete Record |
| Inventory Items | GET | `/api/v1/inventory/inventory-items` | List Records |
| Inventory Items | GET | `/api/v1/inventory/inventory-items/{code}` | Get Record |
| Inventory Items | PATCH | `/api/v1/inventory/inventory-items/{code}` | Update Record |
| Inventory Items | POST | `/api/v1/inventory/inventory-items` | Create Record |
| Inventory Movements | DELETE | `/api/v1/inventory/inventory-movements/{code}` | Delete Record |
| Inventory Movements | GET | `/api/v1/inventory/inventory-movements` | List Records |
| Inventory Movements | GET | `/api/v1/inventory/inventory-movements/{code}` | Get Record |
| Inventory Movements | PATCH | `/api/v1/inventory/inventory-movements/{code}` | Update Record |
| Inventory Movements | POST | `/api/v1/inventory/inventory-movements` | Create Record |
| Learning Resources | DELETE | `/api/v1/academics/learning-resources/{code}` | Delete Record |
| Learning Resources | GET | `/api/v1/academics/learning-resources` | List Records |
| Learning Resources | GET | `/api/v1/academics/learning-resources/{code}` | Get Record |
| Learning Resources | PATCH | `/api/v1/academics/learning-resources/{code}` | Update Record |
| Learning Resources | POST | `/api/v1/academics/learning-resources` | Create Record |
| Leave Requests | DELETE | `/api/v1/human-resources/leave-requests/{code}` | Delete Record |
| Leave Requests | GET | `/api/v1/human-resources/leave-requests` | List Records |
| Leave Requests | GET | `/api/v1/human-resources/leave-requests/{code}` | Get Record |
| Leave Requests | PATCH | `/api/v1/human-resources/leave-requests/{code}` | Update Record |
| Leave Requests | POST | `/api/v1/human-resources/leave-requests` | Create Record |
| Leave Types | DELETE | `/api/v1/human-resources/leave-types/{code}` | Delete Record |
| Leave Types | GET | `/api/v1/human-resources/leave-types` | List Records |
| Leave Types | GET | `/api/v1/human-resources/leave-types/{code}` | Get Record |
| Leave Types | PATCH | `/api/v1/human-resources/leave-types/{code}` | Update Record |
| Leave Types | POST | `/api/v1/human-resources/leave-types` | Create Record |
| Library Books | DELETE | `/api/v1/library/library-books/{code}` | Delete Record |
| Library Books | GET | `/api/v1/library/library-books` | List Records |
| Library Books | GET | `/api/v1/library/library-books/{code}` | Get Record |
| Library Books | PATCH | `/api/v1/library/library-books/{code}` | Update Record |
| Library Books | POST | `/api/v1/library/library-books` | Create Record |
| Library Copies | DELETE | `/api/v1/library/library-copies/{code}` | Delete Record |
| Library Copies | GET | `/api/v1/library/library-copies` | List Records |
| Library Copies | GET | `/api/v1/library/library-copies/{code}` | Get Record |
| Library Copies | PATCH | `/api/v1/library/library-copies/{code}` | Update Record |
| Library Copies | POST | `/api/v1/library/library-copies` | Create Record |
| Library Loans | DELETE | `/api/v1/library/library-loans/{code}` | Delete Record |
| Library Loans | GET | `/api/v1/library/library-loans` | List Records |
| Library Loans | GET | `/api/v1/library/library-loans/{code}` | Get Record |
| Library Loans | PATCH | `/api/v1/library/library-loans/{code}` | Update Record |
| Library Loans | POST | `/api/v1/library/library-loans` | Create Record |
| Message Threads | DELETE | `/api/v1/communications/message-threads/{code}` | Delete Record |
| Message Threads | GET | `/api/v1/communications/message-threads` | List Records |
| Message Threads | GET | `/api/v1/communications/message-threads/{code}` | Get Record |
| Message Threads | PATCH | `/api/v1/communications/message-threads/{code}` | Update Record |
| Message Threads | POST | `/api/v1/communications/message-threads` | Create Record |
| Messages | DELETE | `/api/v1/communications/messages/{code}` | Delete Record |
| Messages | GET | `/api/v1/communications/messages` | List Records |
| Messages | GET | `/api/v1/communications/messages/{code}` | Get Record |
| Messages | PATCH | `/api/v1/communications/messages/{code}` | Update Record |
| Messages | POST | `/api/v1/communications/messages` | Create Record |
| Mobile applications | GET | `/api/v1/mobile/admin/overview` | Overview |
| Mobile applications | GET | `/api/v1/mobile/profile` | Profile |
| Mobile applications | GET | `/api/v1/mobile/students` | Students |
| Mobile applications | GET | `/api/v1/mobile/students/{code}/attendance` | Attendance |
| Mobile applications | GET | `/api/v1/mobile/students/{code}/fees` | Fees |
| Mobile applications | GET | `/api/v1/mobile/teacher/payslips` | Payslips |
| Mobile applications | GET | `/api/v1/mobile/teacher/tax-documents` | Tax Docs |
| Notification Delivery Attempts | GET | `/api/v1/communications/notification-delivery-attempts` | List Records |
| Notification Delivery Attempts | GET | `/api/v1/communications/notification-delivery-attempts/{code}` | Get Record |
| Notifications | DELETE | `/api/v1/communications/notifications/{code}` | Delete Record |
| Notifications | GET | `/api/v1/communications/notifications` | List Records |
| Notifications | GET | `/api/v1/communications/notifications/{code}` | Get Record |
| Notifications | PATCH | `/api/v1/communications/notifications/{code}` | Update Record |
| Notifications | POST | `/api/v1/communications/notifications` | Create Record |
| Parents | DELETE | `/api/v1/student-management/parents/{code}` | Delete Record |
| Parents | GET | `/api/v1/student-management/parents` | List Records |
| Parents | GET | `/api/v1/student-management/parents/{code}` | Get Record |
| Parents | PATCH | `/api/v1/student-management/parents/{code}` | Update Record |
| Parents | POST | `/api/v1/student-management/parents` | Create Record |
| Payment Allocations | GET | `/api/v1/finance/payment-allocations` | List Records |
| Payment Allocations | GET | `/api/v1/finance/payment-allocations/{code}` | Get Record |
| Payment Gateway Events | GET | `/api/v1/finance/payment-gateway-events` | List Records |
| Payment Gateway Events | GET | `/api/v1/finance/payment-gateway-events/{code}` | Get Record |
| Payment Gateway Orders | GET | `/api/v1/finance/payment-gateway-orders` | List Records |
| Payment Gateway Orders | GET | `/api/v1/finance/payment-gateway-orders/{code}` | Get Record |
| Payments | GET | `/api/v1/finance/payments` | List Records |
| Payments | GET | `/api/v1/finance/payments/{code}` | Get Record |
| Payroll Runs | DELETE | `/api/v1/human-resources/payroll-runs/{code}` | Delete Record |
| Payroll Runs | GET | `/api/v1/human-resources/payroll-runs` | List Records |
| Payroll Runs | GET | `/api/v1/human-resources/payroll-runs/{code}` | Get Record |
| Payroll Runs | PATCH | `/api/v1/human-resources/payroll-runs/{code}` | Update Record |
| Payroll Runs | POST | `/api/v1/human-resources/payroll-runs` | Create Record |
| Payslip Lines | GET | `/api/v1/human-resources/payslip-lines` | List Records |
| Payslip Lines | GET | `/api/v1/human-resources/payslip-lines/{code}` | Get Record |
| Payslips | GET | `/api/v1/human-resources/payslips` | List Records |
| Payslips | GET | `/api/v1/human-resources/payslips/{code}` | Get Record |
| Placement Applications | DELETE | `/api/v1/placements/placement-applications/{code}` | Delete Record |
| Placement Applications | GET | `/api/v1/placements/placement-applications` | List Records |
| Placement Applications | GET | `/api/v1/placements/placement-applications/{code}` | Get Record |
| Placement Applications | PATCH | `/api/v1/placements/placement-applications/{code}` | Update Record |
| Placement Applications | POST | `/api/v1/placements/placement-applications` | Create Record |
| Placement Companies | DELETE | `/api/v1/placements/placement-companies/{code}` | Delete Record |
| Placement Companies | GET | `/api/v1/placements/placement-companies` | List Records |
| Placement Companies | GET | `/api/v1/placements/placement-companies/{code}` | Get Record |
| Placement Companies | PATCH | `/api/v1/placements/placement-companies/{code}` | Update Record |
| Placement Companies | POST | `/api/v1/placements/placement-companies` | Create Record |
| Placement Drives | DELETE | `/api/v1/placements/placement-drives/{code}` | Delete Record |
| Placement Drives | GET | `/api/v1/placements/placement-drives` | List Records |
| Placement Drives | GET | `/api/v1/placements/placement-drives/{code}` | Get Record |
| Placement Drives | PATCH | `/api/v1/placements/placement-drives/{code}` | Update Record |
| Placement Drives | POST | `/api/v1/placements/placement-drives` | Create Record |
| Program Document Requirements | DELETE | `/api/v1/admissions/program-document-requirements/{code}` | Delete Record |
| Program Document Requirements | GET | `/api/v1/admissions/program-document-requirements` | List Records |
| Program Document Requirements | GET | `/api/v1/admissions/program-document-requirements/{code}` | Get Record |
| Program Document Requirements | PATCH | `/api/v1/admissions/program-document-requirements/{code}` | Update Record |
| Program Document Requirements | POST | `/api/v1/admissions/program-document-requirements` | Create Record |
| Programs | DELETE | `/api/v1/academics/programs/{code}` | Delete Record |
| Programs | GET | `/api/v1/academics/programs` | List Records |
| Programs | GET | `/api/v1/academics/programs/{code}` | Get Record |
| Programs | PATCH | `/api/v1/academics/programs/{code}` | Update Record |
| Programs | POST | `/api/v1/academics/programs` | Create Record |
| Receipts | GET | `/api/v1/finance/receipts` | List Records |
| Receipts | GET | `/api/v1/finance/receipts/{code}` | Get Record |
| Refund Allocations | GET | `/api/v1/finance/refund-allocations` | List Records |
| Refund Allocations | GET | `/api/v1/finance/refund-allocations/{code}` | Get Record |
| Refunds | GET | `/api/v1/finance/refunds` | List Records |
| Refunds | GET | `/api/v1/finance/refunds/{code}` | Get Record |
| Remittance Allocations | GET | `/api/v1/finance/remittance-allocations` | List Records |
| Remittance Allocations | GET | `/api/v1/finance/remittance-allocations/{code}` | Get Record |
| Report Download Events | DELETE | `/api/v1/reports/report-download-events/{code}` | Delete Record |
| Report Download Events | GET | `/api/v1/reports/report-download-events` | List Records |
| Report Download Events | GET | `/api/v1/reports/report-download-events/{code}` | Get Record |
| Report Download Events | PATCH | `/api/v1/reports/report-download-events/{code}` | Update Record |
| Report Download Events | POST | `/api/v1/reports/report-download-events` | Create Record |
| Report Export Jobs | DELETE | `/api/v1/reports/report-export-jobs/{code}` | Delete Record |
| Report Export Jobs | GET | `/api/v1/reports/report-export-jobs` | List Records |
| Report Export Jobs | GET | `/api/v1/reports/report-export-jobs/{code}` | Get Record |
| Report Export Jobs | PATCH | `/api/v1/reports/report-export-jobs/{code}` | Update Record |
| Report Export Jobs | POST | `/api/v1/reports/report-export-jobs` | Create Record |
| Roles and accounts | DELETE | `/api/v1/administration/accounts/{code}` | Disable Account |
| Roles and accounts | DELETE | `/api/v1/administration/roles/{code}` | Delete Role |
| Roles and accounts | GET | `/api/v1/administration/accounts` | Accounts |
| Roles and accounts | GET | `/api/v1/administration/audit` | Audit Log |
| Roles and accounts | GET | `/api/v1/administration/roles` | Roles |
| Roles and accounts | GET | `/api/v1/administration/screens` | Screens |
| Roles and accounts | PATCH | `/api/v1/administration/accounts/{code}` | Update Account |
| Roles and accounts | POST | `/api/v1/administration/accounts` | Create Account |
| Roles and accounts | POST | `/api/v1/administration/roles` | Create Role |
| Roles and accounts | PUT | `/api/v1/administration/roles/{code}` | Edit Role |
| Rooms | DELETE | `/api/v1/academics/rooms/{code}` | Delete Record |
| Rooms | GET | `/api/v1/academics/rooms` | List Records |
| Rooms | GET | `/api/v1/academics/rooms/{code}` | Get Record |
| Rooms | PATCH | `/api/v1/academics/rooms/{code}` | Update Record |
| Rooms | POST | `/api/v1/academics/rooms` | Create Record |
| Scholarships | DELETE | `/api/v1/finance/scholarships/{code}` | Delete Record |
| Scholarships | GET | `/api/v1/finance/scholarships` | List Records |
| Scholarships | GET | `/api/v1/finance/scholarships/{code}` | Get Record |
| Scholarships | PATCH | `/api/v1/finance/scholarships/{code}` | Update Record |
| Scholarships | POST | `/api/v1/finance/scholarships` | Create Record |
| Sections | DELETE | `/api/v1/academics/sections/{code}` | Delete Record |
| Sections | GET | `/api/v1/academics/sections` | List Records |
| Sections | GET | `/api/v1/academics/sections/{code}` | Get Record |
| Sections | PATCH | `/api/v1/academics/sections/{code}` | Update Record |
| Sections | POST | `/api/v1/academics/sections` | Create Record |
| Semesters | DELETE | `/api/v1/academics/semesters/{code}` | Delete Record |
| Semesters | GET | `/api/v1/academics/semesters` | List Records |
| Semesters | GET | `/api/v1/academics/semesters/{code}` | Get Record |
| Semesters | PATCH | `/api/v1/academics/semesters/{code}` | Update Record |
| Semesters | POST | `/api/v1/academics/semesters` | Create Record |
| Staff Profiles | DELETE | `/api/v1/human-resources/staff-profiles/{code}` | Delete Record |
| Staff Profiles | GET | `/api/v1/human-resources/staff-profiles` | List Records |
| Staff Profiles | GET | `/api/v1/human-resources/staff-profiles/{code}` | Get Record |
| Staff Profiles | PATCH | `/api/v1/human-resources/staff-profiles/{code}` | Update Record |
| Staff Profiles | POST | `/api/v1/human-resources/staff-profiles` | Create Record |
| Student Attendance | DELETE | `/api/v1/student-management/student-attendance/{code}` | Delete Record |
| Student Attendance | GET | `/api/v1/student-management/student-attendance` | List Records |
| Student Attendance | GET | `/api/v1/student-management/student-attendance/{code}` | Get Record |
| Student Attendance | PATCH | `/api/v1/student-management/student-attendance/{code}` | Update Record |
| Student Attendance | POST | `/api/v1/student-management/student-attendance` | Create Record |
| Student Document Links | GET | `/api/v1/admissions/student-document-links` | List Records |
| Student Document Links | GET | `/api/v1/admissions/student-document-links/{code}` | Get Record |
| Student Enrollments | DELETE | `/api/v1/student-management/student-enrollments/{code}` | Delete Record |
| Student Enrollments | GET | `/api/v1/student-management/student-enrollments` | List Records |
| Student Enrollments | GET | `/api/v1/student-management/student-enrollments/{code}` | Get Record |
| Student Enrollments | PATCH | `/api/v1/student-management/student-enrollments/{code}` | Update Record |
| Student Enrollments | POST | `/api/v1/student-management/student-enrollments` | Create Record |
| Student Fee Charges | DELETE | `/api/v1/finance/student-fee-charges/{code}` | Delete Record |
| Student Fee Charges | GET | `/api/v1/finance/student-fee-charges` | List Records |
| Student Fee Charges | GET | `/api/v1/finance/student-fee-charges/{code}` | Get Record |
| Student Fee Charges | PATCH | `/api/v1/finance/student-fee-charges/{code}` | Update Record |
| Student Fee Charges | POST | `/api/v1/finance/student-fee-charges` | Create Record |
| Student Leave Requests | DELETE | `/api/v1/student-management/student-leave-requests/{code}` | Delete Record |
| Student Leave Requests | GET | `/api/v1/student-management/student-leave-requests` | List Records |
| Student Leave Requests | GET | `/api/v1/student-management/student-leave-requests/{code}` | Get Record |
| Student Leave Requests | PATCH | `/api/v1/student-management/student-leave-requests/{code}` | Update Record |
| Student Leave Requests | POST | `/api/v1/student-management/student-leave-requests` | Create Record |
| Student Parents | DELETE | `/api/v1/student-management/student-parents/{code}` | Delete Record |
| Student Parents | GET | `/api/v1/student-management/student-parents` | List Records |
| Student Parents | GET | `/api/v1/student-management/student-parents/{code}` | Get Record |
| Student Parents | PATCH | `/api/v1/student-management/student-parents/{code}` | Update Record |
| Student Parents | POST | `/api/v1/student-management/student-parents` | Create Record |
| Student Scholarships | DELETE | `/api/v1/finance/student-scholarships/{code}` | Delete Record |
| Student Scholarships | GET | `/api/v1/finance/student-scholarships` | List Records |
| Student Scholarships | GET | `/api/v1/finance/student-scholarships/{code}` | Get Record |
| Student Scholarships | PATCH | `/api/v1/finance/student-scholarships/{code}` | Update Record |
| Student Scholarships | POST | `/api/v1/finance/student-scholarships` | Create Record |
| Student Status History | GET | `/api/v1/student-management/student-status-history` | List Records |
| Student Status History | GET | `/api/v1/student-management/student-status-history/{code}` | Get Record |
| Student Subjects | DELETE | `/api/v1/student-management/student-subjects/{code}` | Delete Record |
| Student Subjects | GET | `/api/v1/student-management/student-subjects` | List Records |
| Student Subjects | GET | `/api/v1/student-management/student-subjects/{code}` | Get Record |
| Student Subjects | PATCH | `/api/v1/student-management/student-subjects/{code}` | Update Record |
| Student Subjects | POST | `/api/v1/student-management/student-subjects` | Create Record |
| Students | DELETE | `/api/v1/student-management/students/{code}` | Delete Record |
| Students | GET | `/api/v1/student-management/students` | List Records |
| Students | GET | `/api/v1/student-management/students/{code}` | Get Record |
| Students | PATCH | `/api/v1/student-management/students/{code}` | Update Record |
| Students | POST | `/api/v1/student-management/students` | Create Record |
| Subject Offerings | DELETE | `/api/v1/academics/subject-offerings/{code}` | Delete Record |
| Subject Offerings | GET | `/api/v1/academics/subject-offerings` | List Records |
| Subject Offerings | GET | `/api/v1/academics/subject-offerings/{code}` | Get Record |
| Subject Offerings | PATCH | `/api/v1/academics/subject-offerings/{code}` | Update Record |
| Subject Offerings | POST | `/api/v1/academics/subject-offerings` | Create Record |
| Subjects | DELETE | `/api/v1/academics/subjects/{code}` | Delete Record |
| Subjects | GET | `/api/v1/academics/subjects` | List Records |
| Subjects | GET | `/api/v1/academics/subjects/{code}` | Get Record |
| Subjects | PATCH | `/api/v1/academics/subjects/{code}` | Update Record |
| Subjects | POST | `/api/v1/academics/subjects` | Create Record |
| Teachers | DELETE | `/api/v1/human-resources/teachers/{code}` | Delete Record |
| Teachers | GET | `/api/v1/human-resources/teachers` | List Records |
| Teachers | GET | `/api/v1/human-resources/teachers/{code}` | Get Record |
| Teachers | PATCH | `/api/v1/human-resources/teachers/{code}` | Update Record |
| Teachers | POST | `/api/v1/human-resources/teachers` | Create Record |
| Thread Members | DELETE | `/api/v1/communications/thread-members/{code}` | Delete Record |
| Thread Members | GET | `/api/v1/communications/thread-members` | List Records |
| Thread Members | GET | `/api/v1/communications/thread-members/{code}` | Get Record |
| Thread Members | PATCH | `/api/v1/communications/thread-members/{code}` | Update Record |
| Thread Members | POST | `/api/v1/communications/thread-members` | Create Record |
| Timetable Slots | DELETE | `/api/v1/academics/timetable-slots/{code}` | Delete Record |
| Timetable Slots | GET | `/api/v1/academics/timetable-slots` | List Records |
| Timetable Slots | GET | `/api/v1/academics/timetable-slots/{code}` | Get Record |
| Timetable Slots | PATCH | `/api/v1/academics/timetable-slots/{code}` | Update Record |
| Timetable Slots | POST | `/api/v1/academics/timetable-slots` | Create Record |
| Transport Allocations | DELETE | `/api/v1/transport/transport-allocations/{code}` | Delete Record |
| Transport Allocations | GET | `/api/v1/transport/transport-allocations` | List Records |
| Transport Allocations | GET | `/api/v1/transport/transport-allocations/{code}` | Get Record |
| Transport Allocations | PATCH | `/api/v1/transport/transport-allocations/{code}` | Update Record |
| Transport Allocations | POST | `/api/v1/transport/transport-allocations` | Create Record |
| Transport Routes | DELETE | `/api/v1/transport/transport-routes/{code}` | Delete Record |
| Transport Routes | GET | `/api/v1/transport/transport-routes` | List Records |
| Transport Routes | GET | `/api/v1/transport/transport-routes/{code}` | Get Record |
| Transport Routes | PATCH | `/api/v1/transport/transport-routes/{code}` | Update Record |
| Transport Routes | POST | `/api/v1/transport/transport-routes` | Create Record |
| Transport Stops | DELETE | `/api/v1/transport/transport-stops/{code}` | Delete Record |
| Transport Stops | GET | `/api/v1/transport/transport-stops` | List Records |
| Transport Stops | GET | `/api/v1/transport/transport-stops/{code}` | Get Record |
| Transport Stops | PATCH | `/api/v1/transport/transport-stops/{code}` | Update Record |
| Transport Stops | POST | `/api/v1/transport/transport-stops` | Create Record |
| Vehicles | DELETE | `/api/v1/transport/vehicles/{code}` | Delete Record |
| Vehicles | GET | `/api/v1/transport/vehicles` | List Records |
| Vehicles | GET | `/api/v1/transport/vehicles/{code}` | Get Record |
| Vehicles | PATCH | `/api/v1/transport/vehicles/{code}` | Update Record |
| Vehicles | POST | `/api/v1/transport/vehicles` | Create Record |
| Vendors | DELETE | `/api/v1/finance/vendors/{code}` | Delete Record |
| Vendors | GET | `/api/v1/finance/vendors` | List Records |
| Vendors | GET | `/api/v1/finance/vendors/{code}` | Get Record |
| Vendors | PATCH | `/api/v1/finance/vendors/{code}` | Update Record |
| Vendors | POST | `/api/v1/finance/vendors` | Create Record |
| Website Pages | DELETE | `/api/v1/academics/website-pages/{code}` | Delete Record |
| Website Pages | GET | `/api/v1/academics/website-pages` | List Records |
| Website Pages | GET | `/api/v1/academics/website-pages/{code}` | Get Record |
| Website Pages | PATCH | `/api/v1/academics/website-pages/{code}` | Update Record |
| Website Pages | POST | `/api/v1/academics/website-pages` | Create Record |
