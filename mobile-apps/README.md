# EduNexa mobile apps

There are two installable Flutter apps:

| Project | Login toggle | Dashboard |
| --- | --- | --- |
| `admin/` | Admin / Teacher | College management or teaching modules |
| `parent/` | Parent / Student | Linked children or student modules |

Both apps share `shared/edunexa_client`. Role selection chooses the existing role-specific API client policy; the server controls data access and available screens. Each role opens its own dashboard with module shortcuts, existing workflows, downloads and actions. Sign out to return to the role selector. Secure session restoration remembers the last signed-in role.

The existing native application IDs and project paths are retained for admin and parent installations. The former standalone teacher and student projects have been consolidated into these apps. Backend client identifiers continue to represent four access policies, not four installable apps.

See each project README for setup and run commands.

The shared mobile design uses EduNexa’s college crest, navy and bronze identity, role-specific accents, responsive module shortcuts and bottom navigation. Login controls and module layouts adapt to enlarged accessibility text. Styling is defined in `shared/edunexa_client/lib/mobile_design.dart`.
