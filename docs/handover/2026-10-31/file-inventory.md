# Historical and current file inventory

Captured 2026-10-31 14:10 IST. Workspace base: `/Users/sconex.ios.dev/Leads porjects/edunexa-college`.

The paths below are repository-relative. `M` means currently modified, `??` means untracked. A dash means the file appears in the relevant historical commit manifests but is not currently changed. Historical entries can include files renamed or removed. SHA-256 hashes and exact commit membership are in `file-manifest.json`.

| File | Current status | Relevant commits | Responsibility / note |
|---|---|---|---|
| `admin-dashboard/next-env.d.ts` | `—` | `a1031c3`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/next.config.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/(campus)/layout.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/(campus)/portal/[[...slug]]/page.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/(campus)/verify-certificate/[token]/page.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/colleges-institutions/[collegeSlug]/[[...slug]]/page.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/colleges-institutions/page.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/globals.css` | `—` | `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/page.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/app/robots.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/TemplateSwitcher.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/AcademicProgressWorkspace.tsx` | `??` | — | New semester dashboard, home summary, role-scoped graphs/results/calendar/fee UI and timetable attendance drawer. |
| `admin-dashboard/src/components/colleges/AcademicTimetableGrid.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/AcademicYearForm.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/AdmissionWorkspace.tsx` | `—` | `779c961`, `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/AssessmentWorkspace.tsx` | `M` | `98dce33` | Select current semester from options for new assessment context. |
| `admin-dashboard/src/components/colleges/AssignmentWorkspace.tsx` | `M` | `a1031c3`, `18d5376`, `98dce33` | Default subject from current-semester options. |
| `admin-dashboard/src/components/colleges/AttendanceWorkspace.tsx` | `M` | `98dce33` | Accept scheduled initial class and preserve slot identity for saving. |
| `admin-dashboard/src/components/colleges/CalendarWorkspace.tsx` | `—` | `779c961`, `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/CertificateWorkspace.tsx` | `M` | `779c961`, `18d5376`, `98dce33` | Display template paper-size metadata. |
| `admin-dashboard/src/components/colleges/CollegePage.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/CollegePortal.tsx` | `M` | `a1031c3`, `779c961`, `98dce33` | Route academics to shared progress screen and add dashboard summary. |
| `admin-dashboard/src/components/colleges/CollegeStore.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/ConnectedPortal.tsx` | `M` | `a1031c3`, `779c961`, `18d5376`, `98dce33` | Academic/results routing, home summary, dedicated custom fee-head drawer/create-edit entry. |
| `admin-dashboard/src/components/colleges/CountryCodePicker.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/CourseCards.tsx` | `M` | `98dce33` | Use common insights/semester workspace rather than a duplicate curriculum drawer. |
| `admin-dashboard/src/components/colleges/CourseCurriculum.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/CourseInsightsPanel.tsx` | `M` | — | Embed new semester curriculum/faculty workspace. |
| `admin-dashboard/src/components/colleges/CourseSemesterWorkspace.tsx` | `??` | — | New semester subject/lab breakdown, inline add/edit and faculty allocation. |
| `admin-dashboard/src/components/colleges/ERPFormFields.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/ERPTable.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/ERPWorkspaceTools.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/FeeHeadManager.tsx` | `??` | — | New custom head/category form plus searchable existing-head CRUD table, schema/form metadata and reference protection. |
| `admin-dashboard/src/components/colleges/FeeStructureManager.tsx` | `M` | — | Custom fee-head manager, canonical course duration/batch filtering and explicit semester basis. |
| `admin-dashboard/src/components/colleges/FeeStructures.tsx` | `M` | — | Consistent saved fee cards, semester labels and direct custom-head manager entry. |
| `admin-dashboard/src/components/colleges/IconAction.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/PersonalPortal.tsx` | `M` | `a1031c3`, `779c961`, `98dce33` | Family academic/results routing and overview summary. |
| `admin-dashboard/src/components/colleges/PortalNotFound.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/RolesAccess.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/SearchField.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/SideDrawer.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/StudentAssignmentSummary.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/StudentEnrollmentDetails.tsx` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/SyllabusWorkspace.tsx` | `—` | `779c961`, `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/TableColumnFilter.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/TimetableTemplateWorkspace.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/TransportWorkspace.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/WorkspacePrimaryAction.tsx` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/academic-progress.css` | `??` | — | New responsive academic cards, charts, tabs, tables and editor styles. |
| `admin-dashboard/src/components/colleges/academic-year-form.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/admission-workspace.css` | `—` | `779c961`, `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/assessment-workspace.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/assignment-workspace.css` | `—` | `a1031c3`, `779c961`, `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/attendance-workspace.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/calendar-workspace.css` | `—` | `779c961`, `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/connected-portal.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/course-cards.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/course-semester-workspace.css` | `??` | — | New semester curriculum/inline edit/faculty layout. |
| `admin-dashboard/src/components/colleges/enrollment/StudentEnrollmentWizard.tsx` | `—` | `779c961`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/enrollment/enrollment-wizard.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/fee-head-manager.css` | `??` | — | New fee-head drawer form/table/gutter/responsive styling. |
| `admin-dashboard/src/components/colleges/fee-structures.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/search-field.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/staff/StaffDirectory.tsx` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/student-enrollment-details.css` | `—` | `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/tab-interactions.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/components/colleges/timetable-templates.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/data/colleges/index.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/data/showroomCollection.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/data/templateCatalogue.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/lib/colleges/fees.ts` | `M` | — | Remove fabricated percentage-based fee-head fallback. |
| `admin-dashboard/src/lib/colleges/workspace-cache.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/client.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/config.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/consts.ts` | `M` | — | Optional duration/level/program metadata in lookup options. |
| `admin-dashboard/src/services/api/index.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/modules/academic-progress/service.ts` | `??` | — | New typed academic overview/results/calendar API client. |
| `admin-dashboard/src/services/api/modules/admissions.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/modules/assessments/service.ts` | `M` | `98dce33` | Course workspace types/inline edit/add/faculty methods and current semester options. |
| `admin-dashboard/src/services/api/modules/assignments/calendar.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/modules/assignments/service.ts` | `M` | `a1031c3`, `98dce33` | Current-semester options typing. |
| `admin-dashboard/src/services/api/modules/assignments/syllabus.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/services/api/modules/attendance/service.ts` | `M` | `98dce33` | Scheduled slot_code request typing. |
| `admin-dashboard/src/services/api/modules/certificates.ts` | `M` | `779c961` | Optional certificate paper_size metadata. |
| `admin-dashboard/src/services/api/modules/workspace/catalog.ts` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/styles/college-erp.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/styles/college-operations.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/src/styles/college-timetable.css` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/admin-data-recovery.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/college-login-design.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/fee-head-form.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/fee-structure-cards.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/login-recovery.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/pdf-preview.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/record-controls.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/reported-form-errors.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/staff-directory.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/student-table-display.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/timetable-templates.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/workspace-navigation.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `admin-dashboard/tests/workspace-refresh.spec.ts` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/core/academic_progress.py` | `??` | — | New shared IST timeline/final results/backlogs/analytics/classes/fees/calendar and deduplicated fee-reminder service. |
| `backend/app/core/assessment_workspace.py` | `M` | `98dce33` | Expose current semester in scoped options. |
| `backend/app/core/assignment_workspace.py` | `M` | `a1031c3`, `779c961`, `98dce33` | Expose current semester in scoped options. |
| `backend/app/core/attendance_workspace.py` | `M` | `98dce33` | Resolve scheduled class/subject/semester; reject unallocated scheduled periods and future class start. |
| `backend/app/core/calendar_workspace.py` | `—` | `779c961`, `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/core/certificate_design.py` | `??` | — | New branded ReportLab certificate renderer with five formats, logo/seal/signatory/QR. |
| `backend/app/core/certificate_workspace.py` | `M` | `779c961` | Paper-format metadata; generic academic/fee push route payload fields. |
| `backend/app/core/curriculum_workspace.py` | `M` | `98dce33` | Stable inline subject edits, add, faculty allocation, batch snapshot integration and current personal subjects. |
| `backend/app/core/resources.py` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/core/security.py` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/core/settings.py` | `M` | `779c961` | semester_reminders_enabled setting. |
| `backend/app/core/sql_store.py` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/core/sqlserver.py` | `M` | — | Preserve original failure and close dead SQL connections when rollback fails. |
| `backend/app/core/syllabus_workspace.py` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/main.py` | `M` | `a1031c3`, `779c961`, `98dce33` | Register progress router and persistent-server reminder lifespan worker. |
| `backend/app/modules/academics/academic_years/service.py` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/modules/access_control/authentication/api.py` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/modules/administration/workspace/api.py` | `M` | — | Add course duration/level and academic-year course metadata to lookups. |
| `backend/app/modules/admissions/admission_enquiries/api.py` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/app/modules/documents/files/api.py` | `M` | `a1031c3`, `779c961`, `18d5376` | Delegate certificate PDF rendering to new design module; retain issue/sign/download workflow. |
| `backend/app/modules/master_data/onboarding/api.py` | `M` | — | Validate course/batch/semester fee scope and separate annual/full-course/semester matching. |
| `backend/app/modules/master_data/onboarding/schemas.py` | `M` | — | Allow explicit semester fee basis. |
| `backend/app/modules/mobile/workspace/api.py` | `M` | `a1031c3`, `779c961`, `98dce33` | Expose academic progress screen/summary contracts for mobile role navigation. |
| `backend/assets/pragathi-logo.jpg` | `??` | — | New deployment-local brand asset for backend PDF rendering. |
| `backend/deploy/windows/EduNexaBackend.xml` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/docs/ASSESSMENT_WORKSPACE.md` | `M` | `98dce33` | Assessment/curriculum deployment notes and SQL Mac-vs-Windows connection runbook. |
| `backend/docs/ATTENDANCE_WORKSPACE.md` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/docs/SEMESTER_ACADEMICS.md` | `??` | — | New architecture/data/fee-head/reminder/deployment guide. |
| `backend/tests/conftest.py` | `M` | — | Disable automatic reminder worker in test settings. |
| `backend/tests/test_academic_progress.py` | `??` | — | Timeline, published attempt/backlog, privacy, calendar, attendance period and fee-reminder tests. |
| `backend/tests/test_assessment_workspace.py` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/tests/test_attendance_workspace.py` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/tests/test_certificate_design.py` | `??` | — | Poppler-based one-page/branding/image/link checks for all certificate families. |
| `backend/tests/test_course_semester_workspace.py` | `??` | — | Stable inline subject identity, duplicate/bounds/revision, faculty assignment and permission tests. |
| `backend/tests/test_linked_academic_seed.py` | `??` | — | Linked seed idempotence/no-overwrite/logins and four-role API integration tests. |
| `backend/tests/test_master_data.py` | `M` | — | Fee-basis separation and course/batch mismatch regression tests. |
| `backend/tests/test_sqlserver_integration.py` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `backend/tools/seed_course_curricula.py` | `M` | `98dce33` | Temporary SQL host override; safe missing-plan seeding. |
| `backend/tools/seed_linked_academics.py` | `??` | — | New idempotent linked demo seed, SQL JSON-object metadata, long bulk timeout and private login report. |
| `image copy 2.png` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `image copy 3.png` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `image copy.png` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `image.png` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/README.md` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/README.md` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/app/edunexa_client.dart` | `M` | `18d5376`, `98dce33` | Register academic progress part and navigation icon. |
| `mobile-apps/admin_teachers/lib/components/auth/auth_widgets.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/components/workspace/forms.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/components/workspace/presentations.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/components/workspace/record_helpers.dart` | `—` | `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/components/workspace/widgets.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/constants/api_config.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/main.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/models/api_models.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/screens/academics/academic_progress.dart` | `??` | — | New role-aware semester dashboard, subjects/faculty, class attendance, results/reattempt editor, calendar and fee/payment views. |
| `mobile-apps/admin_teachers/lib/screens/assessments/assessment_workspace.dart` | `M` | `98dce33` | Current-semester default for new work; retained role-specific assessment behavior. |
| `mobile-apps/admin_teachers/lib/screens/assignments/assignment_workspace.dart` | `M` | `18d5376`, `98dce33` | Await list/detail API Futures before decoding; current-semester default subject. |
| `mobile-apps/admin_teachers/lib/screens/attendance/attendance_workspace.dart` | `M` | `98dce33` | Accept initial timetable class and attach slot identity only while context matches. |
| `mobile-apps/admin_teachers/lib/screens/calendar/calendar_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/screens/certificates/certificate_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/screens/syllabus/syllabus_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/screens/workspace/mobile_workspace.dart` | `M` | `18d5376`, `98dce33` | Use AcademicHub for academics/results, add home overview and academic notification routing. |
| `mobile-apps/admin_teachers/lib/services/api_service.dart` | `M` | `a1031c3`, `18d5376`, `98dce33` | New semester overview/result/calendar API methods. |
| `mobile-apps/admin_teachers/lib/services/push_notifications.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/src/assignment_workspace.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/admin_teachers/lib/src/certificate_workspace.dart` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/admin_teachers/lib/src/edunexa_client.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/admin_teachers/lib/src/mobile_workspace.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/admin_teachers/lib/theme/mobile_design.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/lib/utils/mobile_motion.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/pubspec.lock` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/pubspec.yaml` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/academic_progress_test.dart` | `??` | — | Phone semester/subject/backlog/fee interactions including narrow enlarged-text case. |
| `mobile-apps/admin_teachers/test/assessment_workspace_test.dart` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/assignment_loading_test.dart` | `??` | — | Regression tests for asynchronous assignment list and detail decoding. |
| `mobile-apps/admin_teachers/test/attendance_workspace_test.dart` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/auth_experience_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/beige_experience_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/role_navigation_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/splash_screen_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/admin_teachers/test/workspace_features_test.dart` | `M` | `18d5376` | Update expected results-screen title to Academic progress. |
| `mobile-apps/parent_student/README.md` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/app/edunexa_client.dart` | `M` | `18d5376`, `98dce33` | Register academic progress part and navigation icon. |
| `mobile-apps/parent_student/lib/components/auth/auth_widgets.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/components/workspace/forms.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/components/workspace/presentations.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/components/workspace/record_helpers.dart` | `—` | `18d5376`, `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/components/workspace/widgets.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/constants/api_config.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/main.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/models/api_models.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/screens/academics/academic_progress.dart` | `??` | — | New role-aware semester dashboard, subjects/faculty, class attendance, results/reattempt editor, calendar and fee/payment views. |
| `mobile-apps/parent_student/lib/screens/assessments/assessment_workspace.dart` | `M` | `98dce33` | Current-semester default for new work; retained role-specific assessment behavior. |
| `mobile-apps/parent_student/lib/screens/assignments/assignment_workspace.dart` | `M` | `18d5376`, `98dce33` | Await list/detail API Futures before decoding; current-semester default subject. |
| `mobile-apps/parent_student/lib/screens/attendance/attendance_workspace.dart` | `M` | `98dce33` | Accept initial timetable class and attach slot identity only while context matches. |
| `mobile-apps/parent_student/lib/screens/calendar/calendar_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/screens/certificates/certificate_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/screens/syllabus/syllabus_workspace.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/screens/workspace/mobile_workspace.dart` | `M` | `18d5376`, `98dce33` | Use AcademicHub for academics/results, add home overview and academic notification routing. |
| `mobile-apps/parent_student/lib/services/api_service.dart` | `M` | `a1031c3`, `18d5376`, `98dce33` | New semester overview/result/calendar API methods. |
| `mobile-apps/parent_student/lib/services/push_notifications.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/src/assignment_workspace.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/parent_student/lib/src/certificate_workspace.dart` | `—` | `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/parent_student/lib/src/edunexa_client.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/parent_student/lib/src/mobile_workspace.dart` | `—` | `a1031c3`, `779c961` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. Historical path no longer present in the checkout. |
| `mobile-apps/parent_student/lib/theme/mobile_design.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/lib/utils/mobile_motion.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/pubspec.lock` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/pubspec.yaml` | `—` | `a1031c3` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/academic_progress_test.dart` | `??` | — | Phone semester/subject/backlog/fee interactions including narrow enlarged-text case. |
| `mobile-apps/parent_student/test/assessment_workspace_test.dart` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/assignment_loading_test.dart` | `??` | — | Regression tests for asynchronous assignment list and detail decoding. |
| `mobile-apps/parent_student/test/attendance_workspace_test.dart` | `—` | `98dce33` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/auth_experience_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/beige_experience_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/role_navigation_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/splash_screen_test.dart` | `—` | `18d5376` | Earlier committed supporting implementation/test/configuration; inspect the listed commit for its exact diff. |
| `mobile-apps/parent_student/test/workspace_features_test.dart` | `M` | `18d5376` | Update expected results-screen title to Academic progress. |
| `mock_logins.html` | `??` | — | Untracked file present before handover; authorship and contents not reviewed. May contain credentials. Do not auto-commit or publish. |
