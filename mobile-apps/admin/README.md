# EduNexa Admin mobile app

Native Flutter management demo. Four working screens: Overview, Dues, Reports and Activity. Shows collections, scholarships, remaining student balances, expenditure, external remittances and net cash movement. Period filters affect receipts and expenses, not lifetime student balances. Reports can be viewed and copied as CSV through the device clipboard. Uses fictional in-memory records in major INR units, not the web portal's paise. The snapshot is explicitly dated 22 October 2026. It is not synchronized with the web preview.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run` on your configured Android/iOS device. No production login, backend, live alerts or bank integration has been implemented. Configure your own iOS signing team. Python backend remains intentionally empty.

Matching web preview: /colleges-institutions/edunexa-college/portal/admin/admin-app . Log in as Super Admin first, or open the floating Mobile apps panel and select Admin. Principal and Accounts Manager also have a management preview with their demo role.
