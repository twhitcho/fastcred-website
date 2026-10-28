# FastCred Financial Services

The public website and loans desk for FastCred Financial Services (Pvt) Ltd, a registered micro-financier in Harare, Zimbabwe.

- `docs/`: the website (GitHub Pages serves this folder)
  - `index.html`: public site: loans, calculator, online application with document upload, loan tracking, guarantor form, blog
  - `admin.html`: loans desk for staff: review, approve/reject with reasons, release funds, repayments, messages
- `supabase/fastcred.sql`: database, security rules, document storage, SMS/WhatsApp sending and reminders
- `SETUP.md`: step-by-step setup guide

Borrowers' details and documents are stored in Supabase, never in this repository.
