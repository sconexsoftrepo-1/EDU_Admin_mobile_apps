# Token authentication: admin web and four mobile apps

## Endpoint contract

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/auth/login` | Validate credentials and issue access/refresh tokens |
| `POST /api/v1/auth/refresh` | Rotate refresh token and invalidate the old session |
| `GET /api/v1/auth/me` | Current account and live role definitions |
| `POST /api/v1/auth/logout` | Revoke current session family, including its access token |
| `POST /api/v1/auth/logout-all` | Revoke all sessions for the account |
| `POST /api/v1/auth/change-password` | Verify old password, replace hash and revoke every session |

Login request:

```json
{"login_id":"your-individual-login","password":"your-password","client":"admin-web"}
```

The password above is a descriptive placeholder, not a configured account. Permitted client identifiers are `admin-web`, `admin-mobile`, `teacher-mobile`, `parent-mobile`, `student-mobile`. Account client allowlists are enforced on login, refresh and every authenticated request. A client string is a policy selector, not proof of a specific app installation.

Successful response:

```json
{"access_token":"...","refresh_token":"...","token_type":"bearer","expires_in":600,"account":{"code":"...","login_id":"..."}}
```

Send `Authorization: Bearer ACCESS_TOKEN` on protected requests. The refresh body is `{"refresh_token":"...","client":"admin-web"}`. Replace **both** tokens atomically after refresh. One refresh invalidates the old access token. Reusing an old refresh token revokes the entire family, including newly rotated tokens. Serialize refresh calls per client to avoid accidentally triggering reuse detection.

A 401 means credentials/session/token validity failed. Refresh once on an expired access token; if refresh fails, clear tokens and show login. Do not refresh repeatedly on 401. A 403 means the authenticated account lacks permission and should not trigger refresh. Disabling an account or changing account roles revokes its sessions. Role-permission edits are evaluated live on subsequent requests.

## Admin browser integration

The current portal's local demo role selector is not a security boundary. Replace its login with `/auth/login` and derive visible screens from `/auth/me`. Every API still checks permissions server-side.

Keep tokens in application memory; do not place access/refresh tokens in URLs, localStorage or logs. This development API returns tokens as JSON for explicit bearer clients. For a persistent browser login, add a same-origin backend-for-frontend that keeps refresh tokens server-side and uses Secure, HttpOnly, SameSite cookies plus CSRF protection. No cookie session or persistent browser SDK is installed by this backend deliverable. Use HTTPS beyond loopback development. Set exact permitted CORS origins in `.env`; credentialed cross-origin cookies are disabled.

## Flutter integration

Use a shared auth service for all four apps with the corresponding `client` identifier. Keep access tokens in memory. Persist refresh tokens only through OS-backed Keychain/Keystore storage (for example an approved secure-storage package), never ordinary shared preferences. The signing secret belongs only on the backend; never ship it in Flutter or browser bundles.

Your HTTP interceptor should attach the access token, single-flight refresh on expiry, atomically replace tokens, retry the original request once, and clear secure storage on logout or refresh rejection. Serialize refresh requests across concurrent calls. User passwords should be discarded immediately after login.

Identity-scoped endpoints:

- All apps: `GET /api/v1/mobile/profile`.
- Student/Parent: `GET /api/v1/mobile/students`, `GET /api/v1/mobile/students/{code}/fees`, `GET /api/v1/mobile/students/{code}/attendance`. Ownership comes from the authenticated student or linked parent.
- Teacher: `GET /api/v1/mobile/teacher/payslips` and `/teacher/tax-documents`. Only the signed-in employee's published records are returned. Binary download/storage integration is pending.
- Admin: `GET /api/v1/mobile/admin/overview`, with `reports:view` permission and an admin client session.

## Roles and employees

Create employee details through the employee screen API. Create a role using `POST /api/v1/administration/roles`, specifying a screen/action map such as `{"student_fee_charges":["view"],"reports":["view","export"]}`. Discover valid screen names through `/administration/screens`.

Create a login with `POST /api/v1/administration/accounts`, including `person_type`, existing `person_code`, `role_codes`, allowed `clients`, individual `login_id` and password of 12–128 characters. Accounts are not shared by a role. `PATCH /administration/accounts/{code}` assigns/replaces roles, client allowlists or active status. Roles show assigned accounts with their employee details. Unassign all accounts before deleting a role. `DELETE /administration/accounts/{code}` disables the account and retains its audit identity.

The bootstrap administrator cannot be deleted or modified through these APIs. Sensitive account and role mutation permissions cannot be delegated by ordinary role definitions. Student and parent users are blocked from generic staff resource endpoints even when a role is misconfigured to grant a table permission. Staff permissions are screen-level within this single-college development setup; campus/class-level staff scoping must be added before a multi-campus deployment.

## Implemented protections and remaining production work

Passwords use Argon2. JWT signatures, issuer, audience, required claims, expiry, allowed algorithm, current account status and current session are verified. Refresh tokens are random, only SHA-256 hashes are stored, and rotation is atomic under the local store lock. Failed login attempts are limited by normalized login and connection IP. Requests are limited to 1 MiB; responses disable caching and sniffing. Audit events exclude password/token values and full request bodies.

The backend is a first-party credential API, not a complete OAuth/OIDC authorization server. SSO, MFA, password reset/recovery, device attestation and production distributed rate limiting are not implemented. The local JSON store is not encrypted at rest; use protected development data only. Use production secret management and approved durable storage before handling live student data.

References: [FastAPI JWT example](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [RFC 9700 refresh-token security](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).
