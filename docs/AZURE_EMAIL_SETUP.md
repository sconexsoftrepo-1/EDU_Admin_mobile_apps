# Azure Email for EduNexa – create the service, add pragathiews.org, send emails

Goal: EduNexa sends emails (sign-in codes now, notices later) from **donotreply@pragathiews.org**,
shown as **Pragathi College**, through **Azure Communication Services (ACS) Email**.

| Item | Value |
|---|---|
| Azure subscription / resource group | `Azure subscription` / `Pragathi` |
| Email service (domains) | `pragathi-email` (Email Communication Services) |
| Sending service (keys) | `pragathi-comm` (Communication Services) |
| Domain | `pragathiews.org` – DNS hosted at **HostGator** (cPanel) |
| Sender | `donotreply@pragathiews.org`, display name **Pragathi College** |
| Who receives codes | staff logins (admin dashboard, EduDesk app); email is **required** on every staff login |

Already set: **Pragathi Admin** (Akhil) → `vssakhilpavan@gmail.com`, **Chaitanya** →
`kattachaitanya507@gmail.com`.

Time: about 30 minutes of clicks + up to a few hours for DNS to update.

---

## Part 1 – Create the Email Communication Service (Azure portal)

1. Go to **portal.azure.com** → search bar → **Email Communication Services** → **+ Create**.
2. **Basics**:
   - Subscription: **Azure subscription**
   - Resource group: **Pragathi**
   - Name: **`pragathi-email`**
   - Data location: **United States** (pick India if it is offered)
3. **Review + create** → **Create** → wait for *Your deployment is complete* → **Go to resource**.

## Part 2 – Create the Communication Services resource (this one sends the email)

1. Search bar → **Communication Services** → **+ Create**.
2. **Basics**:
   - Resource group: **Pragathi**
   - Name: **`pragathi-comm`**
   - Data location: **the same as Part 1**
3. **Review + create** → **Create** → **Go to resource**.

## Part 3 – Add the domain pragathiews.org

### 3.1 In Azure

1. Open **`pragathi-email`** → left menu **Settings → Provision domains** → **+ Add domain** →
   **Custom domain**.
2. Domain name: **`pragathiews.org`** → confirm → **Add**.
3. Click the domain **pragathiews.org** in the list. You see four rows – **Domain**, **SPF**,
   **DKIM**, **DKIM2** – each with **Configure**. Click **Configure** on each to see the DNS record
   (type, name, value). Keep this page open.

### 3.2 In HostGator (where the domain's DNS lives)

1. Log in to **HostGator** → **cPanel** for pragathiews.org → **Domains → Zone Editor** →
   `pragathiews.org` → **Manage**.
2. **Domain verification (TXT)**
   - **+ Add Record** → Type **TXT**
   - Name: `pragathiews.org.` (or `@`)
   - Record: the value from Azure, e.g. `ms-domain-verification=xxxxxxxx-…`
   - **Save Record**
3. **SPF (edit, do not add a second one)**
   - Find the existing **TXT** record that starts with `v=spf1` – today it is
     `v=spf1 a mx include:webhostbox.net ~all`
   - **Edit** it to:
     ```
     v=spf1 a mx include:webhostbox.net include:spf.protection.outlook.com ~all
     ```
   - **Save Record**. (A domain may have only ONE `v=spf1` record. This keeps the college's current
     email working and allows Azure.)
4. **DKIM (CNAME)**
   - **+ Add Record** → Type **CNAME**
   - Name: as Azure shows, e.g. `selector1-azurecomm-prod-net._domainkey`
   - Record: as Azure shows, e.g. `selector1-azurecomm-prod-net._domainkey.azurecomm.net`
   - **Save Record**
5. **DKIM2 (CNAME)** – the same with `selector2-…`.
6. **DMARC (recommended, helps avoid spam)**
   - **+ Add Record** → Type **TXT**, Name `_dmarc`, Record `v=DMARC1; p=none;` → **Save Record**.

Do **not** change the **MX** records or `mail.pragathiews.org` – they are the college's existing mailboxes.

### 3.3 Verify in Azure

1. Back on the domain page in Azure → **Configure → Verify** on **Domain** first.
2. Then **SPF**, **DKIM**, **DKIM2**.
3. All four must show **Verified**. DNS can take from 5 minutes to a few hours; repeat **Verify**.

If SPF does not verify: check there is exactly one `v=spf1` record and it contains
`include:spf.protection.outlook.com`. If Azure insists on its own value, stop and ask before
removing anything from the existing record.

## Part 4 – Sender address donotreply@pragathiews.org

1. `pragathi-email` → **Provision domains** → **pragathiews.org** → **MailFrom addresses** → **+ Add**.
2. Display name: **Pragathi College** · MailFrom address: **`donotreply`** → **Save**.
3. (Optional) remove the default `DoNotReply` entry if you only want the one address.

## Part 5 – Connect the domain to the sending service

1. Open **`pragathi-comm`** → left menu **Email → Domains** → **Connect domain**.
2. Subscription **Azure subscription**, resource group **Pragathi**, email service **pragathi-email**,
   verified domain **pragathiews.org** → **Connect**.

## Part 6 – Send the first email (portal test)

1. `pragathi-comm` → **Email → Try Email**.
2. Send email from: **donotreply@pragathiews.org**; recipient: your own Gmail; subject/body: anything →
   **Send**.
3. Check Gmail (also *Spam*). Open the email → **⋮ → Show original**: **SPF PASS**, **DKIM PASS**,
   **DMARC PASS** mean the setup is correct.

## Part 7 – Connect EduNexa (backend)

1. `pragathi-comm` → **Settings → Keys** → copy **Primary connection string**
   (`endpoint=https://pragathi-comm…;accesskey=…`). Treat it like a password: never in chat or Git.
2. On the Mac, add to **`backend/.env`**:
   ```
   EDUNEXA_EMAIL_CONNECTION_STRING=<Primary connection string>
   EDUNEXA_EMAIL_SENDER=donotreply@pragathiews.org
   EDUNEXA_EMAIL_SENDER_NAME=Pragathi College
   ```
3. Test: on the dashboard sign-in page choose your role, enter your login ID or email and press
   **Send code**. The code arrives from `DoNotReply@pragathiews.org` within a minute.
4. Live backend: add the same three settings to web app **edunexa-api-pragathi** → **Environment
   variables** (or rerun `deploy/azure/make_backend_settings.py` and paste the file), or put the
   connection string in Key Vault and reference it. **Apply**.

## Part 8 – Limits, cost, security

- **Cost:** about **$0.25 per 1,000 emails** + $0.00012 per MB – a few rupees a month for staff codes.
- **Sending limits:** custom domains start with a modest per-minute/per-hour quota; if many codes or
  notices are sent at once, request an increase: *Help + support → New support request → Service and
  subscription limits → Communication Services → Email sending limits*.
- **Keys:** if the connection string leaks: `pragathi-comm` → **Keys** → **Regenerate primary key**, then
  update `.env` and the App Service setting.
- **Deliverability:** keep SPF, DKIM and DMARC verified; send only expected emails (codes, notices); do
  not use `donotreply@` for marketing.

---

## What the sign-in code email will look like

```
From:    Pragathi College <donotreply@pragathiews.org>
Subject: 482915 is your EduNexa Admin sign-in code

Hi Akhil,
Your one-time code for EduNexa Admin (Pragathi College) is 482915.
It expires in 5 minutes. Do not share it with anyone.
If you did not try to sign in, ignore this email.
```

(App name: **EduNexa Admin** on the dashboard, **EduDesk** in the mobile app.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| *Verify* fails for Domain | TXT record name must be the root (`@` / `pragathiews.org.`); wait 15 minutes, verify again |
| SPF not verified | exactly one `v=spf1` record containing `include:spf.protection.outlook.com` |
| DKIM not verified | CNAME name must not repeat the domain twice (cPanel may add `.pragathiews.org` itself) |
| `donotreply@pragathiews.org` not offered in *Try Email* | Part 4 (MailFrom) and Part 5 (Connect domain) not done |
| Email lands in Spam | add DMARC (3.2 step 6); wait a day for reputation; check *Show original* for PASS |
| Backend log says *DomainNotLinked* / *Unauthorized* | wrong connection string, or domain not connected to `pragathi-comm` |

Sources: [ACS Email overview](https://learn.microsoft.com/azure/communication-services/concepts/email/email-overview) ·
[Add a custom verified domain](https://learn.microsoft.com/azure/communication-services/quickstarts/email/add-custom-verified-domains) ·
[ACS email pricing](https://learn.microsoft.com/azure/communication-services/concepts/email-pricing)
