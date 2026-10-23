# EduNexa Teacher Flutter app

Generated Android and iOS project, with a role-specific module outline. This is a starter, not the complete native implementation of the existing mobile web screens.

Run `flutter pub get`, `flutter analyze`, then `flutter run`. Android requires an Android SDK/emulator. iOS builds require Xcode, signing and an Apple developer setup. Configure signing for your own team before distribution.

Planned modules: Assigned classes and timetable, Attendance entry, Assignments and grading, Exam marks, Leave and announcements. No login, API calls, push notifications, payment integration, or local production storage are configured. The backend folder is intentionally empty. Use backend/app/contracts/schema-catalog.json (or backend/docs/API_REFERENCE.txt) and client-data/initial-data-entry/import-contract-v2.json when designing the future Python API. Do not access SQL directly from Flutter.
