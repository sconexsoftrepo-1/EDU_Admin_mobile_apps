# OTP sign-in and SMS – setup guide

**Scope:** OTP sign-in for **staff only** – the admin dashboard (`admin-web`) and the EduDesk app
(`admin-mobile`, `teacher-mobile`). Parents and students (EduNest) keep their current sign-in.

**Already in place**

- Every staff login must have an **email** (sign-in codes go there first – see
  `docs/AZURE_EMAIL_SETUP.md`). A **mobile number** (`country_code` + `mobile_number`) is optional for now;
  when given, Indian numbers must be 10 digits starting with 6–9, and one number or email belongs to one
  login only (dashboard: *Person logins* card; API: `POST/PATCH /api/v1/administration/accounts`).
- Admin logins: **Pragathi Admin** (Akhil, vssakhilpavan@gmail.com, +91 9398202206) and **Chaitanya**
  (kattachaitanya507@gmail.com, +91 8367048538).
- The backend already has settings for an SMS gateway: `EDUNEXA_SMS_ADAPTER_URL`,
  `EDUNEXA_SMS_ADAPTER_TOKEN` (App Service → Environment variables).

---

## Part A – Choose how SMS reaches Indian phones

Every business SMS to an Indian number must follow **TRAI DLT** rules: the sender (the college) is
registered, the 6-letter **sender ID** is registered, and **each message text (template)** is approved.
Unregistered messages are blocked by the operators.

| Route | Works for India today | Effort | Typical price |
|---|---|---|---|
| **A1. Indian DLT SMS gateway** (MSG91, Gupshup, Kaleyra, Exotel, Twilio India…) | Yes | 3–7 working days (DLT approval) | ~₹0.15–0.25 per OTP + GST |
| **A2. Azure Communication Services + Messaging Connect** (Microsoft's partner route) | Check availability for India and your subscription first | weeks (partner onboarding + DLT) | partner pricing |

**Recommendation: A1** for go-live. It is the proven path for Indian OTP traffic. The keys and the
backend still live in Azure (App Service settings / Key Vault), so everything stays managed from Azure.
A2 can replace it later without changing the apps.

---

## Part B – DLT registration (needed for both routes)

Done once, in the **college's name** (needs PAN, GST certificate, a signed letter of authorisation
on letterhead, and the authorised person's ID).

1. Register as a **Principal Entity** on one operator's DLT portal (any one is enough; all operators
   share the data):
   - Jio: `trueconnect.jio.com` · Airtel: `dltconnect.airtel.in` · Vi: `vilpower.in` · BSNL: `ucc-bsnl.co.in`
   - Fee: about ₹5,000–6,000 + GST, once. Approval: 1–3 working days. You receive an **Entity ID (PE ID)**.
2. **Register the sender ID (header)**: 6 letters, e.g. `PRGATI`, category *Transactional / Service
   Implicit*. Approval: 1–2 days.
3. **Register the OTP template** (category **Service Implicit**), exactly as the app will send it,
   with the code as a variable:

   ```
   {#var#} is your EduNexa sign-in code for Pragathi College. It is valid for 5 minutes. Do not share it with anyone. - PRGATI
   ```

   Note the **Template ID** you receive. Register any other messages (fee reminders, late fees) the
   same way if they will also go by SMS.
4. Link your SMS provider (A1) or Microsoft's partner (A2) as the **telemarketer** in the DLT
   portal ("Telemarketer binding / Chain"), so their traffic is accepted under your entity.

---

## Part C1 – Route A1: DLT SMS gateway (example: MSG91)

1. Sign up at the provider (company account in the college's name), complete KYC.
2. In the provider's console add the **DLT Entity ID**, the **sender ID** `PRGATI`, and the OTP
   **template** with its **DLT Template ID**. (MSG91: *SMS → Templates → Add DLT template*; for OTP
   use *OTP → Create template* and paste the approved text.)
3. Buy credits (OTP route). Enable *Low balance alert*.
4. Create an **API key / auth token** (MSG91: *Authkey* under your profile). Restrict it to the
   backend's outbound IPs if the console allows it (App Service → *Networking → Outbound
   addresses*).
5. Note: API base URL, auth key, sender ID, template ID.
6. Test from the console: send the OTP template to Akhil's and Chaitanya's numbers.

## Part C2 – Route A2: Azure Communication Services (Messaging Connect)

1. Portal → **Communication Services → + Create**: resource group `Pragathi`, name
   `pragathi-comm`, data location **India** (or United States if India is not offered) → Create.
2. Open it → **Telephony and SMS → Messaging Connect** (or *Phone numbers / Sender IDs*). Check that
   **India** is listed for your subscription. If it is not, open *Help + support → New support
   request → Communication Services → SMS → India sender ID / Messaging Connect* and ask for
   availability.
3. Follow the partner onboarding Microsoft shows (partner account, DLT Entity ID, sender ID and
   template IDs from Part B).
4. **Keys**: Communication Services → *Settings → Keys* → copy the **connection string**.
5. Test with *Try SMS* in the portal (to the two admin numbers).

---

## Part D – Keep the keys in Azure

1. Portal → **Key vaults → + Create**: `kv-pragathi`, resource group `Pragathi`, region **West US 3**,
   permission model *Azure role-based access control*.
2. **Secrets → + Generate/Import**: `sms-api-key` (provider key or ACS connection string). (Later also the
   database password and storage key.)
3. Backend web app **edunexa-api-pragathi** → **Identity → System assigned → On** → Save.
4. Key vault → **Access control (IAM) → Add role assignment → Key Vault Secrets User** → the web app's
   identity.
5. Backend web app → **Environment variables** → add:

   | Name | Value |
   |---|---|
   | `EDUNEXA_SMS_PROVIDER` | `msg91` (or `acs`) |
   | `EDUNEXA_SMS_API_KEY` | `@Microsoft.KeyVault(SecretUri=https://kv-pragathi.vault.azure.net/secrets/sms-api-key/)` |
   | `EDUNEXA_SMS_SENDER_ID` | `PRGATI` |
   | `EDUNEXA_SMS_OTP_TEMPLATE_ID` | the DLT template ID |
   | `EDUNEXA_SMS_DLT_ENTITY_ID` | the Entity ID |

   → **Apply**. (These names are a suggestion for the code you add in Part E; the existing
   `EDUNEXA_SMS_ADAPTER_URL/TOKEN` settings can be used instead if you send through an adapter.)

---

## Part E – What the OTP sign-in should do (for the developer)

Staff sign-in with OTP, in the backend (`app/modules/access_control/authentication/`):

1. **`POST /api/v1/auth/otp/request`** – body: `country_code`, `mobile_number`, `client`
   (`admin-web`, `admin-mobile` or `teacher-mobile` only).
   - Find the **active** staff login with that number (`accounts.country_code` + `mobile_number`).
   - Always answer the same neutral message ("If the number is registered, a code was sent"), so the
     endpoint does not reveal which numbers exist.
   - Make a **6-digit** code with `secrets.randbelow`, keep only its **hash** (as passwords are kept),
     with the login, the client, an expiry of **5 minutes** and an attempt counter.
   - Limits: one code per number per **60 seconds**, at most **5 per hour**; at most 5 per IP per hour.
   - Send the SMS with the approved template (Part B text, code in `{#var#}`).
2. **`POST /api/v1/auth/otp/verify`** – body: `country_code`, `mobile_number`, `code`, `client`.
   - At most **5 wrong attempts**, then the code is void.
   - On success: delete the code and issue the same tokens as `POST /auth/login` (same session,
     refresh and audit handling), so the dashboard proxy and the EduDesk app need no other change.
3. Record `otp_requested`, `otp_failed`, `otp_signed_in` in the audit log (never the code itself).
4. Dashboard login page: *Sign in with mobile* → country code + number → *Send code* → 6 boxes →
   *Verify*. EduDesk app: the same two screens. EduNest (parents/students): unchanged.
5. Keep password sign-in as a fallback for admins until OTP has worked for a few weeks.

**Testing before go-live**

1. With the SMS settings empty, the code can be written to the backend log (development only).
2. With the provider configured: request a code for Akhil and Chaitanya, sign in on the dashboard and
   in EduDesk, try a wrong code 5 times, try an unknown number, wait 5 minutes for expiry.
3. Check the provider's delivery report and the DLT template ID on each message.

---

## Costs (approximate)

| Item | Cost |
|---|---|
| DLT entity registration | ₹5,000–6,000 + GST, once |
| OTP SMS (route A1) | ₹0.15–0.25 per message + GST |
| 200 staff × 2 sign-ins a day × 22 days | ≈ 8,800 SMS ≈ ₹1,800–2,600 a month |
| Key Vault | a few rupees a month |

Sources: [Azure Communication Services – SMS overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/concepts) ·
[Messaging Connect overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/messaging-connect) ·
[Enable alphanumeric sender ID](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/sms/enable-alphanumeric-sender-id) ·
[Indian DLT SMS gateway walkthrough](https://abhishekjoshi-dev.medium.com/from-dlt-registration-to-sms-delivery-building-a-fully-compliance-indian-sms-gateway-e89e87fe5b86).
Confirm prices with the provider and Azure before quoting them.
