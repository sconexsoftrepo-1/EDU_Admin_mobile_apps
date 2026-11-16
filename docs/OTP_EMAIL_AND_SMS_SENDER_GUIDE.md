# OTP by email now, SMS later – step-by-step guide

**Short answer**

- **Now:** send the sign-in OTP **by email** with **Azure Communication Services (ACS) Email**. Fully inside
  Azure, no phone-number or DLT registration, about **$0.25 per 1,000 emails**, set up in ~30 minutes.
- **Later:** add **SMS** OTP through an Indian SMS provider once the college's DLT registration is done
  (see `docs/OTP_SMS_SETUP.md`).
- The message can look exactly like your MeetStreet one – user name, app name and the code:

  ```
  Subject: 482915 is your EduDesk sign-in code

  Hi Akhil,
  Your one-time code for EduNexa Admin (Pragathi College) is 482915.
  It expires in 5 minutes. Do not share it with anyone.
  If you did not try to sign in, ignore this email.
  ```

Scope stays the same: OTP for **staff only** (admin dashboard and the EduDesk app). Parents and
students (EduNest) keep their current sign-in.

---

## Part 1 – Why the SMS "number" works differently in India

| What you saw | What it is | How you get one |
|---|---|---|
| OTP from a number like **56161702** (MeetStreet) | a **short code** or an **international route** number owned by the SMS provider | the provider assigns it; you don't register it yourself |
| OTP from **VM-PRGATI**, **AD-PRGATI** … (most Indian apps) | a **DLT sender ID (header)** – 6 letters registered by the business | DLT registration (Part 5), then any Indian SMS provider |

- **Indian rules (TRAI DLT):** a business SMS to an Indian mobile is delivered only if the business, its
  6-letter sender name and the exact message text are registered. Indian apps therefore show a name
  (`VM-PRGATI`), not a number.
- **Numeric senders** reach Indian phones only through a provider's **international route**: more
  expensive (often ₹1–4 per SMS), the number can change, and operators may filter it. Fine for testing,
  not recommended for a college's daily sign-ins.
- **Azure's own SMS numbers** (ACS → Phone numbers, e.g. US toll-free) are for sending in the countries
  Microsoft lists; I could not find Indian mobiles in that list, so they are not a route to Indian
  phones. India is only mentioned through Microsoft's partner route *Messaging Connect*, which still
  needs DLT.

**So:** email OTP now (Parts 2–4), SMS after DLT (Part 5).

---

## Part 2 – Create Azure Email (portal, ~20 minutes)

All in resource group **Pragathi**.

### Step 1 – Email Communication Service

1. Portal → search **Email Communication Services** → **+ Create**.
2. Resource group **Pragathi**, name `pragathi-email`, **Data location: United States** (or India if
   offered) → **Review + create → Create**.

### Step 2 – A sender domain

**Option A – Azure-managed domain (instant, for testing)**

1. Open `pragathi-email` → **Settings → Provision domains** → **+ Add domain → Azure domain**.
2. In a minute you get a sender like `DoNotReply@xxxxxxxx-xxxx.azurecomm.net`.
3. Limits are low (a handful of emails per minute/hour) – enough to test, not for daily use.

**Option B – the college's own domain (for go-live)**, e.g. `mail.pragathicollege.in`

1. `pragathi-email` → **Provision domains → + Add domain → Custom domain** → enter `mail.<your domain>`.
2. Azure shows DNS records. Add them at the domain registrar (GoDaddy, Hostinger, …):
   - **TXT** (domain verification) → wait for **Verified**
   - **SPF** (TXT) → **Verify**
   - **DKIM** and **DKIM2** (CNAME) → **Verify**
3. Status becomes **Verified** for all four (DNS can take up to a few hours).
4. Optional: **MailFrom addresses** → add `no-reply@mail.<your domain>`, display name **Pragathi College**.
5. Higher sending limits than Option A; request more through *Help + support* if needed.

### Step 3 – Communication Services resource (the sender)

1. Portal → **Communication Services → + Create**: resource group **Pragathi**, name `pragathi-comm`,
   data location **the same as Step 1** → Create.
2. Open `pragathi-comm` → **Email → Domains** → **Connect domain** → pick `pragathi-email` and the
   domain from Step 2 → **Connect**.
3. **Settings → Keys** → copy **Primary connection string**.

### Step 4 – Send a test email from the portal

`pragathi-comm` → **Email → Try Email** → sender = your domain's address, recipient = your own email
→ **Send**. Check it arrives (and is not in spam).

---

## Part 3 – Give the backend the email settings

1. (Recommended) Put the connection string in **Key Vault** (`docs/OTP_SMS_SETUP.md`, Part D) as secret
   `acs-email-connection`.
2. Backend web app **edunexa-api-pragathi** → **Settings → Environment variables** → add:

   | Name | Value |
   |---|---|
   | `EDUNEXA_EMAIL_CONNECTION_STRING` | the connection string (or `@Microsoft.KeyVault(SecretUri=…/secrets/acs-email-connection/)`) |
   | `EDUNEXA_EMAIL_SENDER` | `DoNotReply@xxxx.azurecomm.net` or `no-reply@mail.<your domain>` |
   | `EDUNEXA_EMAIL_SENDER_NAME` | `Pragathi College` |

3. **Apply → Confirm**. Also add the same three lines to `backend/.env` on the Mac for local testing.

---

## Part 4 – Every staff login needs an email address

OTP by email goes to the address on the login. **Email is now required on every staff login** (dashboard
*Person logins* card → *Email*); Akhil and Chaitanya already have theirs. Full email setup for
`donotreply@pragathiews.org`: `docs/AZURE_EMAIL_SETUP.md`.

### What the OTP sign-in does (for the developer)

1. **Request:** `POST /api/v1/auth/otp/request` with the login ID **or** registered mobile number and the
   client (`admin-web`, `admin-mobile`, `teacher-mobile`). Always answers the same neutral message.
   Makes a 6-digit code (`secrets.randbelow`), stores only its **hash**, valid **5 minutes**; at most one
   code per 60 seconds and 5 per hour per login.
2. **Send:** the email above, through ACS Email (`azure-communication-email` Python package:
   `EmailClient.from_connection_string(...).begin_send(message)`), with the user's name, the app name
   (EduNexa Admin or EduDesk) and the code. Later the same code can also go by SMS (Part 5).
3. **Verify:** `POST /api/v1/auth/otp/verify` with the code; 5 wrong tries void it; on success it issues the
   same tokens as password sign-in, so the dashboard proxy and the EduDesk app work unchanged.
4. Audit: `otp_requested`, `otp_failed`, `otp_signed_in` (never the code).
5. Keep password sign-in as a fallback until OTP has run for a few weeks.

**Cost:** about $0.00025 per email + $0.00012 per MB ≈ **₹2–5 a month** for 200 staff signing in twice a day.

---

## Part 5 – SMS later (when the college wants it)

1. **DLT registration** in the college's name (PAN, GST, authorisation letter) on Jio / Airtel / Vi /
   BSNL DLT portal → **Entity ID** (≈ ₹5,000–6,000 + GST once, 1–3 days).
2. Register a **6-letter sender ID**, e.g. `PRGATI` → this is what phones show (`VM-PRGATI`).
3. Register the OTP **template**, e.g.
   `{#var#} is your EduDesk sign-in code for Pragathi College. Valid for 5 minutes. Do not share it. - PRGATI`
4. Open an account with an Indian SMS provider (MSG91, Gupshup, Kaleyra, Twilio India …), link the
   Entity ID, sender ID and template ID, buy OTP credits (≈ ₹0.15–0.25 per SMS + GST).
5. Put the provider key in Key Vault and the App Service settings; the OTP code then goes by SMS
   to the registered mobile number (already mandatory for staff logins) as well as by email.

Details: `docs/OTP_SMS_SETUP.md`.

---

Sources: [Azure Communication Services – SMS overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/concepts) ·
[Messaging Connect](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/messaging-connect) ·
[ACS email pricing](https://learn.microsoft.com/azure/communication-services/concepts/email-pricing).
Check current prices and sending limits in the portal before quoting them.
