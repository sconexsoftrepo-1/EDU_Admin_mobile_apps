# EduNexa Parents & Students

One Flutter app for parents & students. Select your role on the login screen, then sign in with your college account. The app opens a role-specific dashboard with the modules authorized by the server. The selected role is remembered for secure session restoration. Sign out to use another role.

This is a self-contained Flutter project. The app shell lives in `lib/app/`; feature screens live in `lib/screens/`; reusable UI lives in `lib/components/`; All REST paths and API calls live in `lib/services/api_service.dart`; the base URL and API prefix live in `lib/constants/api_config.dart`; API models and configuration live in `lib/models/` and `lib/constants/`; design and motion helpers live in `lib/theme/` and `lib/utils/`; all dependencies are declared in this project’s `pubspec.yaml`. The login selector uses the existing `parent-mobile` and `student-mobile` API client policies; permissions and account access remain enforced by the backend.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run --dart-define=API_BASE_URL=https://your-college-server`. For an Android emulator use `http://10.0.2.2:8010` during development. The default test-server URL is `http://150.241.246.34:8010`. Override it with `--dart-define=API_BASE_URL=...` for local development or HTTPS production. Release builds require HTTPS. Configure iOS signing for your team before distribution.

See [mobile workspace and push setup](../README.md) for the implemented screens, Firebase build options, server adapter contract and live-payment requirements.
