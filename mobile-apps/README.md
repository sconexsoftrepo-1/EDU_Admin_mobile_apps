# EduNexa mobile apps

There are exactly two self-contained Flutter app projects:

| Project folder | Login toggle | Dashboard |
| --- | --- | --- |
| `admin_teachers/` | Admin / Teacher | College management or teaching modules |
| `parent_student/` | Parent / Student | Linked children or student modules |

Each project contains its own screens, API client, styling, tests, and Android/iOS project files. There is no shared package or dependency on the other app. Screen and design code live in each app’s `lib/src/` folder. Each app has its own independent `lib/services/` folder for API calls, models and configuration.

Role selection chooses the existing role-specific API client policy. The server controls data access and available screens. Each role opens its own dashboard with module shortcuts, downloads and actions. Sign out to return to the role selector. Secure session restoration remembers the last signed-in role.

The existing native application IDs are retained for admin and parent installations. Backend client identifiers continue to represent four access policies for the two installable apps.

The mobile design uses EduNexa’s college crest, navy and bronze identity, role-specific accents, responsive module shortcuts and bottom navigation. Login controls and module layouts adapt to enlarged accessibility text. Styling is defined in each project’s `lib/src/mobile_design.dart`.

Quote folder names in shell commands, for example:

```sh
cd admin_teachers
flutter pub get
flutter run --dart-define=API_BASE_URL=https://your-college-server
```

See each project README for setup and run commands.

## Mobile workspace

Both projects now include the same app-local workspace components; each remains independently buildable.

| Role | Bottom tabs | Other authorized screens |
| --- | --- | --- |
| Admin | Home, Finance, Calendar, Inbox, More | Outstanding fees, collections/receipts, expenses, reports/PDF export, students, admissions, employees, hostel, audit, announcements, profile |
| Teacher | Home, Classes, Calendar, Inbox, More | Timetable/swap requests, attendance sessions/entry, assignments, grading, resources, exam marks, leave, payslips, tax documents, announcements, messages, profile |
| Parent | Home, Fees, Calendar, Inbox, More | Child selector, payments/receipts, attendance, student leave, results, timetable, assignments, resources, certificates, hostel/pickup, transport, announcements, messages, profile |
| Student | Home, Study, Calendar, Inbox, More | Timetable, attendance, resources, results, fees, payments/receipts, certificates, leave, library, hostel, transport, announcements, messages, profile |

Home shows live finance or academic summaries, shortcuts, today's classes, upcoming events and published college updates. All modules are also available from More and the drawer. Screens include search, pagination, details, refresh, loading/error/empty states and role-scoped server forms. Forms offer record selectors, date/time pickers and validation. Parents can switch only between linked children. Notifications have an unread filter and inline mark-as-read. Administrators can publish events and announcements and send in-app alerts when their permissions allow it.

The UI reads actual API records. Mock login profiles do not automatically create class enrollments, assignments, fee charges or payment history. These records must be entered through college workflows; empty screens identify missing records without inventing balances or academic activity.

Deploy/restart the updated Python backend along with the apps: the new device/alert routes, event forms, private administrator inbox and form lookups are implemented there. No schema migration is required. Local source changes do not update an already running remote deployment.

## Device push setup

In-app notifications work without Firebase. Native push is opt-in from Inbox → Enable device alerts. The app registers the installation with the authenticated backend, renews its registration, shows foreground alerts, opens the inbox on a notification tap and removes device registration on sign-out. It uses Firebase Messaging 17's registration API.

For each application/platform, provide the values from its own Firebase app registration at build time:

```sh
flutter run --dart-define=API_BASE_URL=https://your-college-server \
  --dart-define=FIREBASE_API_KEY=your-app-api-key \
  --dart-define=FIREBASE_APP_ID=your-platform-app-id \
  --dart-define=FIREBASE_PROJECT_ID=your-project-id \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=your-sender-id \
  --dart-define=FIREBASE_IOS_BUNDLE_ID=your-existing-ios-bundle-id
```

Android uses the retained application IDs and minimum SDK 24. iOS requires iOS 15+, a signing team/provisioning profile with Push Notifications enabled, and the APNs authentication key uploaded in Firebase. Background remote notifications and development/production push entitlements are included. Web preview builds keep the in-app inbox; native push registration is Android/iOS only.

Configure `EDUNEXA_PUSH_ADAPTER_URL` and `EDUNEXA_PUSH_ADAPTER_TOKEN` on the Python server to connect its selected push provider. The HTTPS adapter receives `{idempotency_key, tokens, title, body, data: {notification_code}}`, authenticated with Bearer and Idempotency-Key headers, and must return `{"accepted": true}` after provider acceptance. Its implementation must support the Firebase Messaging SDK's registration targets, OS notification payloads for background display and APNs/Android notification settings. Provider secrets belong on that server, never in Flutter defines. `POST /api/v1/mobile/alerts` sends a persisted in-app alert and optionally requests push delivery. Missing configuration, missing devices and provider failures are reported; provider acceptance is not a claim the user has read the alert.

Online fee payment uses the existing HTTPS checkout adapter and callback verification. The UI opens checkout, reloads balances on resume and exposes confirmed receipts. It never marks a payment successful merely because checkout opened. Gateway credentials and callback configuration are still required for live settlement.

## Validation

Run `flutter analyze --no-pub --no-fatal-infos` and `flutter test --no-pub` inside each app. `test/workspace_features_test.dart` renders all 63 role/screen combinations against API fixtures exported from an isolated local demo store, checks the five tabs, payment/date validation and enlarged calendar text. Authentication/session tests also cover secure storage, refresh rotation, role restoration and logout. The fixture data is fictional and is never loaded into a signed-in production workspace.

## Independent API service folders

Each app owns the following files; neither imports service files from the other app:

```text
admin_teachers/lib/services/
  api_service.dart       # All REST endpoints, authenticated calls, refresh and downloads
  conts.dart             # Base URL, API prefix, timeouts, client IDs, storage keys, Firebase options
  constants.dart         # Request payloads, response models, query/form models and API errors
  push_notifications.dart # Native Firebase registration, foreground handling and tap lifecycle

parent_student/lib/services/
  api_service.dart
  conts.dart
  constants.dart
  push_notifications.dart
```

Change `ApiConfig.baseUrl` in the relevant app's `conts.dart`, or set `API_BASE_URL` when building that app. `constants.dart` defines `LoginPayload`, `RefreshPayload`, `WorkspaceQuery`, `WorkspaceActionPayload`, `DeviceRegistrationPayload`, `TokenPayload`, `AlertPayload`, `AuthResponse`, `AccountResponse`, `WorkspaceScreen`, `WorkspaceResponse`, `ActionResponse`, `ActionDefinition` and `FormFieldDefinition`. JSON conversion stays with these models. Server-defined fields and business records are preserved for configurable forms and screen descriptors.

Screens call `CollegeApi.listScreens`, `workspace`, `executeAction`, `markNotificationRead`, `registerDevice`, `unregisterDevice`, `download` and `downloadFinanceReport`; they do not construct REST paths. Service tests import `services/api_service.dart` directly and verify URL/query construction, payload serialization, response parsing, authentication headers and device/notification requests.
