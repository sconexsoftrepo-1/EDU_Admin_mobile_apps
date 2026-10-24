# EduNexa mobile apps

There are exactly two self-contained Flutter app projects:

| Project folder | Login toggle | Dashboard |
| --- | --- | --- |
| `admin & teachers/` | Admin / Teacher | College management or teaching modules |
| `parent & student mobile app/` | Parent / Student | Linked children or student modules |

Each project contains its own screens, API client, styling, tests, and Android/iOS project files. There is no shared package or dependency on the other app. Screen and design code live in each app’s `lib/src/` folder.

Role selection chooses the existing role-specific API client policy. The server controls data access and available screens. Each role opens its own dashboard with module shortcuts, downloads and actions. Sign out to return to the role selector. Secure session restoration remembers the last signed-in role.

The existing native application IDs are retained for admin and parent installations. Backend client identifiers continue to represent four access policies for the two installable apps.

The mobile design uses EduNexa’s college crest, navy and bronze identity, role-specific accents, responsive module shortcuts and bottom navigation. Login controls and module layouts adapt to enlarged accessibility text. Styling is defined in each project’s `lib/src/mobile_design.dart`.

Quote folder names in shell commands, for example:

```sh
cd "admin & teachers"
flutter pub get
flutter run --dart-define=API_BASE_URL=https://your-college-server
```

See each project README for setup and run commands.
