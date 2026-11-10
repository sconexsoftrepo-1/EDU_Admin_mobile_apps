# Firebase push notifications — setup guide

One Firebase project serves **both** mobile apps (4 app registrations: EduDesk and EduNest, each on
Android and iOS). The server sends every push; the apps only receive them. The web dashboard needs
no Firebase setup.

| App | Folder | Android package | iOS bundle ID |
|---|---|---|---|
| EduDesk (staff, clerks, admins) | `mobile-apps/admin_teachers` | `com.edunexa.edunexa_admin` | `com.edunexa.edunexaAdmin` |
| EduNest (parents, students) | `mobile-apps/parent_student` | `com.edunexa.edunexa_parent` | `com.edunexa.edunexaParent` |

What is already in the code (nothing to change):
- Both apps start Firebase from values passed at build time (`--dart-define`), so **no
  `google-services.json` or `GoogleService-Info.plist` goes into the apps**.
- Android notification channels: **Messages** (`chat_messages`, high priority) and **College
  updates** (`college_updates`); the Android 13+ notification permission is requested in the app.
- iOS: Push Notifications entitlement (`aps-environment`: development for debug, production for
  release) and the *Remote notifications* background mode.
- Phones register their push token with the server (`/mobile/devices/register`) when push is turned
  on; it is turned on automatically at first sign-in.
- The server sends pushes through Firebase Cloud Messaging HTTP v1 when it has a service-account key.

---

## Step 1 — Register the four apps in the Firebase project

Firebase console → your project → ⚙ **Project settings** → **General** → **Your apps** → **Add app**.

1. **Android** → package name `com.edunexa.edunexa_admin`, nickname `EduDesk Android` → *Register app*.
   You may download `google-services.json` (it holds the values for Step 4) but **do not add it to
   the app**. Skip the "Add Firebase SDK" steps.
2. **Android** → `com.edunexa.edunexa_parent`, nickname `EduNest Android`.
3. **iOS** (Apple) → bundle ID `com.edunexa.edunexaAdmin`, nickname `EduDesk iOS`. You may download
   `GoogleService-Info.plist` for the values; do not add it to Xcode.
   **Skip the "Add Firebase SDK" step** (Xcode *File > Add Packages* → `firebase-ios-sdk`,
   FirebaseAnalytics) and the "Add initialization code" step: click **Next** → **Next** →
   **Continue to console**. These are Flutter apps — the `firebase_core` / `firebase_messaging`
   plugins already bring in the Firebase iOS SDK and start Firebase in code. Adding the SDK in Xcode
   as well puts Firebase in the app twice and the build fails with duplicate libraries.
   Analytics is not used.
4. **iOS** → `com.edunexa.edunexaParent`, nickname `EduNest iOS`.

## Step 2 — Turn on Cloud Messaging

Project settings → **Cloud Messaging**:
- **Firebase Cloud Messaging API (V1)** must show *Enabled* (if not, open the ⋮ menu → *Manage API in
  Google Cloud Console* → **Enable**).
- The *Cloud Messaging API (Legacy)* is **not** needed — leave it disabled.

## Step 3 — iOS only: connect Apple Push Notifications (APNs)

Needs the paid Apple Developer account that signs the apps.

1. developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** → open
   `com.edunexa.edunexaAdmin` → tick **Push Notifications** → *Save*. Repeat for
   `com.edunexa.edunexaParent`. (Create the identifiers first if they do not exist.)
2. **Keys** → **+** → name it `EduNexa APNs` → tick **Apple Push Notifications service (APNs)** →
   *Continue* → *Register* → **Download** the `.p8` file (it can be downloaded only once — store it
   safely). Note the **Key ID** and your **Team ID** (top right of the developer site).
3. Firebase → Project settings → **Cloud Messaging** → **Apple app configuration** → select
   **EduDesk iOS** → *APNs Authentication Key* → **Upload** → the `.p8`, Key ID and Team ID.
   Select **EduNest iOS** and upload the **same** key again. One key serves both apps, in both
   development and production.
4. After changing capabilities, regenerate the provisioning profiles (Xcode does this automatically
   with *Automatically manage signing*).

## Step 4 — Collect the values each build needs

Project settings → **General** → **Your apps** → click each app (or open its downloaded
`google-services.json` / `GoogleService-Info.plist`).

| Build value | Where to find it | Same for all 4 apps? |
|---|---|---|
| `FIREBASE_PROJECT_ID` | General → *Project ID* | Yes |
| `FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging → *Sender ID* (= project number) | Yes |
| `FIREBASE_APP_ID` | Your apps → the app → *App ID* (`1:…:android:…` / `1:…:ios:…`) | **No — one per app and platform** |
| `FIREBASE_API_KEY` | Android: `current_key` in google-services.json; iOS: `API_KEY` in the plist | One for Android, one for iOS |
| `FIREBASE_IOS_BUNDLE_ID` | iOS builds only: the bundle ID above | Per app |

Create one value file per app and platform **inside the app folder** (they are git-ignored as
`firebase-*.json`), for example `mobile-apps/admin_teachers/firebase-android.json`:

```json
{
  "FIREBASE_API_KEY": "AIza…android-key…",
  "FIREBASE_APP_ID": "1:123456789012:android:abc123…",
  "FIREBASE_PROJECT_ID": "your-project-id",
  "FIREBASE_MESSAGING_SENDER_ID": "123456789012"
}
```

and `mobile-apps/admin_teachers/firebase-ios.json`:

```json
{
  "FIREBASE_API_KEY": "AIza…ios-key…",
  "FIREBASE_APP_ID": "1:123456789012:ios:def456…",
  "FIREBASE_PROJECT_ID": "your-project-id",
  "FIREBASE_MESSAGING_SENDER_ID": "123456789012",
  "FIREBASE_IOS_BUNDLE_ID": "com.edunexa.edunexaAdmin"
}
```

Do the same in `mobile-apps/parent_student` with the EduNest App IDs and
`com.edunexa.edunexaParent`.

## Step 5 — Give the server its Firebase key

1. Firebase → Project settings → **Service accounts** → **Generate new private key** → JSON file.
   This is a secret: never put it in an app, never commit it.
2. Copy it to the server (150.241.246.34), e.g. `/opt/edunexa/secrets/fcm-service-account.json`,
   and restrict it: `chmod 600 …`.
3. In the server's `backend/.env` add:

   ```
   EDUNEXA_FCM_SERVICE_ACCOUNT_FILE=/opt/edunexa/secrets/fcm-service-account.json
   ```

4. Restart the backend. (For local testing on the Mac, put the same line in the local
   `backend/.env` with the local path.)

## Step 6 — Build and install the apps with Firebase

From each app folder:

```bash
# Android (EduDesk shown; same command in parent_student)
flutter build apk --release --dart-define-from-file=firebase-android.json
#   or for Play Store: flutter build appbundle --release --dart-define-from-file=firebase-android.json

# iOS
flutter build ipa --release --dart-define-from-file=firebase-ios.json

# Running on a device while developing
flutter run --dart-define-from-file=firebase-android.json      # Android phone
flutter run --dart-define-from-file=firebase-ios.json          # iPhone
```

Add `--dart-define=API_BASE_URL=http://127.0.0.1:8010` only when testing against a local backend
(the default is the live server). Without the Firebase values an app still works but shows no
phone notifications (only the in-app list).

## Step 7 — Test

1. Install on a **real phone** (iOS push is only reliable on a physical iPhone) and sign in. Allow
   notifications when asked (Android 13+ / iOS).
2. Check the phone registered: the server's `device_tokens` table gets a row for that login.
3. Trigger something and watch the notification bar:

   | Test | Who gets the push |
   |---|---|
   | Send a chat message | The other person(s) in the chat (EduDesk / EduNest) |
   | Cashbook → *Transfer cash* to `clerk-01` | The clerk |
   | Clerk collects / deposits / submits slip | Admins |
   | Admin accepts / rejects the slip | The clerk |
   | A non-admin edits a record on the dashboard | Super Admin; then the requester when decided |
   | Approve a certificate request | The student / parent |
   | Publish an assignment or assessment marks | Students / parents |
   | Add a calendar event | Its audience |
   | Fee due in ≤ 6 days (3 a day) / late fee added | Students and parents |
   | Student leave decided | The student / parent |
   | Staff leave decided | The staff member |
   | Fee payment recorded | The student and parents (opens that payment) |
   | Announcement published (dashboard or app) | Staff, students and parents of its campus |
   | Student marked absent or late | The student and parents |

4. Each sent notice records the result: the `notifications` row gets `push_status` = `accepted`
   (sent) or `failed`. Pushes show in the notification bar even while the app is open. Tapping one
   (or a row in the in-app Notifications screen) opens the matching screen: the chat, the cash
   handover with its deposits, change requests, the payment details, announcements, the calendar
   event, certificates, attendance or leave. **Clear read** on the Notifications screen hides the
   read notices (they stay in the database).

## Troubleshooting

| Symptom | Check |
|---|---|
| Nothing arrives on any phone | `EDUNEXA_FCM_SERVICE_ACCOUNT_FILE` set and readable on the server; backend restarted; FCM API (V1) enabled |
| `push_status` = `failed` | Service-account key belongs to this Firebase project; server clock correct |
| Nothing arrives after the app is closed (Realme/OPPO/Xiaomi/Vivo) | The app asks at startup to run in the background - tap Allow; App info > Battery > *Allow background activity* / Autostart. A force-stopped app gets no pushes (Android rule) |
| Android only fails | App built with `firebase-android.json`; notifications allowed in Android settings for the app |
| iOS only fails | APNs key uploaded for **that** iOS app; Push Notifications enabled on its App ID; real device; release build uses the production entitlement automatically |
| No row in `device_tokens` | App built with the Firebase values; the user signed in after installing that build |

Announcements scheduled for a later date are not notified when they go live (only when published
immediately).
