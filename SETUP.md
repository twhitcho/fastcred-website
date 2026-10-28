# FastCred website & loans desk: setup guide

There are two parts:

| Part | Address | Who uses it |
|---|---|---|
| Public website | `https://fastcred.pages.dev/` | Clients apply, upload documents, track their loan, guarantors fill in their form |
| Loans desk | `https://fastcred.pages.dev/admin.html` | Loan officers review, approve or reject with reasons, release funds, record payments |

Data and documents live in your **Supabase** project. Messages go out through **Twilio**.

---

## 1. Set up the database (once, about 3 minutes)

1. Open your `fastcred` project at supabase.com.
2. Go to **SQL Editor → New query**.
3. Open `supabase/fastcred.sql` from this folder, copy everything, paste it in and click **Run**.
   You should see "Success". You can run it again later safely, for example after an update.

This creates:
- the tables for applications, documents, guarantors, repayments and messages
- a **private** storage bucket called `loan-docs`. Clients can upload into their own application only. Only signed-in staff can open documents.
- the automatic jobs: messages go out every minute, and follow-ups run every morning at 08:00 Harare time

## 2. Connect the website to the database

Supabase → **Project Settings → API**. Copy the **Project URL** and the **anon / publishable** key into `docs/assets/config.js`:

```js
window.FASTCRED_BACKEND = {
  url: "https://YOUR-PROJECT.supabase.co",
  key: "YOUR-ANON-OR-PUBLISHABLE-KEY"
};
```

Never put the `service_role` / secret key in the website.

Also go to **Authentication → URL Configuration** and set **Site URL** to
`https://fastcred.pages.dev/admin.html`. Password reset links then go to the loans desk.

## 3. Create your first admin (the loans desk login)

1. Supabase → **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto confirm**.
2. In **SQL Editor**, run this with your own email and name:

```sql
insert into public.staff (user_id, full_name, email, role)
select id, 'Thomas Whitcho', email, 'admin' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set role = 'admin', active = true;
```

3. Open the loans desk and sign in.

To add loan officers later, create their login in **Authentication → Users**, then add them in the loans desk under **Settings → Staff**.
Roles:
- **officer**: review, approve, reject, release funds, record payments, message clients
- **manager**: officer rights, plus editing message wording and lending settings
- **admin**: manager rights, plus managing staff

Also go to **Authentication → Providers → Email** and turn off **Allow new users to sign up**, so only people you create can log in.

## 4. Connect Twilio for SMS and WhatsApp

In Twilio, copy your **Account SID** and **Auth Token** (Console home page), and buy an SMS-capable number or set up a Messaging Service.

In Supabase **SQL Editor**, run this with your own values. Your token goes straight into Supabase's encrypted Vault and never into the website:

```sql
select vault.create_secret('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'twilio_account_sid');
select vault.create_secret('your_auth_token',                    'twilio_auth_token');
select vault.create_secret('+1XXXXXXXXXX',                       'twilio_sms_from');      -- your Twilio number, or a Messaging Service SID (MG...)
select vault.create_secret('+1XXXXXXXXXX',                       'twilio_whatsapp_from'); -- your WhatsApp-enabled Twilio number (when approved)
```

To change one later: `select vault.update_secret((select id from vault.secrets where name='twilio_auth_token'), 'new_value');`

Messages queued before Twilio is connected wait and then send automatically.

### WhatsApp templates

WhatsApp only allows business-started messages that use templates Meta has approved. In Twilio go to **Messaging → Content Template Builder**. Create one template for each message you want on WhatsApp, using the same wording as the loans desk (Settings → Automatic messages), and submit it for WhatsApp approval. Then paste each template's **Content SID** (starts with `HX`) next to that message in the loans desk.

Until a template is approved, WhatsApp delivery may fail. After 5 failed tries the system sends the same message by **SMS** instead.

## 5. What happens automatically

| When | Client receives |
|---|---|
| Application submitted | Confirmation with reference number and tracking link |
| Officer starts review | "Your application is being reviewed" |
| Officer requests information | Exactly what is needed, plus an upload link. Reminded every 3 days, up to 3 times. |
| Approved | Approved amount, term and any conditions |
| Rejected | The officer's reason |
| Funds released | Amount and first due date |
| 3 days before each due date | Friendly reminder |
| Due date | "Due today" |
| 1 and 7 days overdue | Overdue notices |
| Payment recorded | Receipt and remaining balance |
| Fully repaid | Thank-you message |

Clients choose SMS, WhatsApp or both on the application form. Managers can edit every message in **Settings → Automatic messages**, or pause all sending with the `sending_enabled` setting.

## 6. Publish on GitHub Pages

The website is in the `docs/` folder. In GitHub, open the repo → **Settings → Pages**, then set **Source: Deploy from a branch**, **Branch: main**, **Folder: /docs**, and click **Save**.
The site is live at `https://fastcred.pages.dev/` in about a minute.

To use FastCred's own domain later (e.g. `www.fastcred.co.zw`), add it under **Settings → Pages → Custom domain**. Then update `site_url` in the loans desk Settings and the Site URL in Supabase.

## Things to confirm
- Official email address (currently `info@fastcred.co.zw`) and opening hours: `docs/assets/data.js`
- The interest rate and terms in the public calculator (`docs/assets/data.js`, `calc`) should match the loans desk settings `monthly_rate`, `min_term` and `max_term`.
