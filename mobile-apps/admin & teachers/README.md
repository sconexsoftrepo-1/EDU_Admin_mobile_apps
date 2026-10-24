# EduNexa Admin & Teachers

One Flutter app for admin & teachers. Select your role on the login screen, then sign in with your college account. The app opens a role-specific dashboard with the modules authorized by the server. The selected role is remembered for secure session restoration. Sign out to use another role.

This is a self-contained Flutter project. App screens, authentication and styling live in `lib/src/`; all dependencies are declared in this project’s `pubspec.yaml`. The login selector uses the existing `admin-mobile` and `teacher-mobile` API client policies; permissions and account access remain enforced by the backend.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run --dart-define=API_BASE_URL=https://your-college-server`. For an Android emulator use `http://10.0.2.2:8010` during development. The default development URL is `http://127.0.0.1:8010`. Release builds require HTTPS. Configure iOS signing for your team before distribution.
