-- =====================================================================
--  FastCred Financial Services — loans back office (Supabase)
--  Run this whole file once in Supabase: SQL Editor → New query → Run.
--  Safe to re-run: it updates functions and keeps your data.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
--  Settings & message templates (editable from the officer portal)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key   text primary key,
  value text not null,
  note  text
);
insert into public.settings(key,value,note) values
 ('site_url',        'https://twhitcho.github.io/fastcred-website/', 'Public website address used in messages'),
 ('office_phone',    '+263 86 440 85732',                          'Phone number shown in messages'),
 ('monthly_rate',    '0.10',                                       'Interest per month used for repayment schedules'),
 ('min_term',        '1',                                          'Shortest repayment period (months)'),
 ('max_term',        '4',                                          'Longest repayment period (months)'),
 ('min_amount',      '50',                                         'Smallest loan (US$)'),
 ('max_amount',      '10000',                                      'Largest loan (US$)'),
 ('sending_enabled', 'true',                                       'Set to false to pause all SMS/WhatsApp sending'),
 ('reminder_days_before', '3',                                     'Days before a due date to send a reminder')
on conflict (key) do nothing;

create table if not exists public.message_templates (
  key           text primary key,
  label         text not null,
  body          text not null,
  wa_content_sid text,            -- Twilio Content SID of the approved WhatsApp template (optional)
  enabled       boolean not null default true
);
insert into public.message_templates(key,label,body) values
 ('received',      'Application received',  'FastCred: Hi {first_name}, we have received your {product} application (ref {ref}). A loans officer will contact you soon. Track it at {site_url}#track'),
 ('under_review',  'Under review',          'FastCred: Hi {first_name}, your application {ref} is now being reviewed by our loans team. We will update you shortly.'),
 ('more_info',     'More information needed','FastCred: Hi {first_name}, we need more information for application {ref}: {reason}. Please upload it at {site_url}#track or call {office_phone}.'),
 ('more_info_reminder','Reminder: information still needed','FastCred: Reminder {first_name}, we are still waiting for: {reason}. Upload at {site_url}#track (ref {ref}) so we can finish your application.'),
 ('approved',      'Approved',              'FastCred: Good news {first_name}! Your loan {ref} is approved for US${approved_amount} over {approved_term} month(s). {reason} Please visit us with your original documents to sign. Call {office_phone}.'),
 ('rejected',      'Not approved',          'FastCred: Hi {first_name}, we are sorry, we cannot approve application {ref} at this time. Reason: {reason}. Call {office_phone} if you would like to discuss it.'),
 ('disbursed',     'Funds released',        'FastCred: Hi {first_name}, US${approved_amount} has been released for loan {ref}. Your first repayment of US${installment_amount} is due on {due_date}.'),
 ('reminder_before','Repayment due soon',   'FastCred: Hi {first_name}, a friendly reminder that your repayment of US${amount_due} for loan {ref} is due on {due_date}.'),
 ('reminder_due',  'Repayment due today',   'FastCred: Hi {first_name}, your repayment of US${amount_due} for loan {ref} is due today ({due_date}). Thank you for paying on time.'),
 ('overdue_1',     'Overdue (1 day)',       'FastCred: Hi {first_name}, your repayment of US${amount_due} for loan {ref} was due on {due_date} and is now overdue. Please pay today or call {office_phone}.'),
 ('overdue_7',     'Overdue (7 days)',      'FastCred: {first_name}, your repayment of US${amount_due} for loan {ref} is 7 days overdue. Please contact us urgently on {office_phone} to avoid further action.'),
 ('payment_received','Payment received',    'FastCred: Thank you {first_name}. We received US${paid} for loan {ref} on {paid_on}. Outstanding balance: US${balance}.'),
 ('loan_closed',   'Loan fully repaid',     'FastCred: Congratulations {first_name}! Loan {ref} is fully repaid. Thank you for growing with FastCred. You are welcome to apply again.'),
 ('guarantor_received','Guarantor form received','FastCred: Hi {first_name}, thank you for completing the guarantor form (ref {ref}) for {loanee}. Our team may call you to confirm your details.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  Staff
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email     text,
  role      text not null default 'officer' check (role in ('officer','manager','admin')),
  active    boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.staff where user_id = auth.uid() and active);
$$;
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------------
--  Core tables
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  client_updated_at timestamptz,
  product       text not null,
  product_name  text,
  is_business   boolean not null default false,
  amount        numeric(12,2) not null,
  term          int not null,
  loan_type     text,
  purpose       text,
  applicant_name text not null,
  mobile        text not null,
  email         text,
  id_number     text,
  notify_channel text not null default 'sms' check (notify_channel in ('sms','whatsapp','both')),
  guarantor_mode text,
  data          jsonb not null default '{}',
  status        text not null default 'submitted'
                check (status in ('submitted','under_review','more_info','approved','rejected','disbursed','closed','withdrawn')),
  decision_reason text,
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  approved_amount numeric(12,2),
  approved_term int,
  monthly_rate  numeric(6,4),
  disbursed_on  date,
  assigned_to   uuid references auth.users(id),
  upload_token  uuid not null default gen_random_uuid()
);
create index if not exists applications_status_idx on public.applications(status, created_at desc);
create index if not exists applications_mobile_idx on public.applications(mobile);

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  guarantor_id   uuid,
  kind        text not null,
  label       text,
  file_path   text not null unique,
  file_name   text,
  size_bytes  bigint,
  mime        text,
  uploaded_at timestamptz not null default now(),
  verified    boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz
);
create index if not exists documents_app_idx on public.documents(application_id);

create table if not exists public.guarantors (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,
  created_at    timestamptz not null default now(),
  application_id uuid references public.applications(id) on delete set null,
  application_ref text,
  loanee_name   text,
  full_name     text not null,
  mobile        text not null,
  id_number     text,
  data          jsonb not null default '{}',
  upload_token  uuid not null default gen_random_uuid(),
  status        text not null default 'submitted' check (status in ('submitted','verified','rejected'))
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='documents_guarantor_fk') then
    alter table public.documents add constraint documents_guarantor_fk foreign key (guarantor_id) references public.guarantors(id) on delete cascade;
  end if;
end $$;

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       uuid references auth.users(id),
  actor_name  text,
  kind        text not null,      -- status | note | document | message | payment | system
  status_from text,
  status_to   text,
  note        text,
  client_visible boolean not null default false
);
create index if not exists events_app_idx on public.events(application_id, at);

create table if not exists public.installments (
  id            uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  n             int not null,
  due_date      date not null,
  amount        numeric(12,2) not null,
  paid_amount   numeric(12,2) not null default 0,
  last_paid_on  date,
  status        text not null default 'due' check (status in ('due','overdue','paid')),
  unique(application_id, n)
);
create index if not exists installments_due_idx on public.installments(status, due_date);

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  paid_on       date not null,
  method        text,
  reference     text,
  recorded_by   uuid references auth.users(id),
  recorded_at   timestamptz not null default now()
);

create table if not exists public.outbox (
  id            bigint generated always as identity primary key,
  application_id uuid references public.applications(id) on delete set null,
  guarantor_id  uuid references public.guarantors(id) on delete set null,
  template_key  text,
  channel       text not null check (channel in ('sms','whatsapp')),
  to_phone      text not null,
  body          text not null,
  variables     jsonb,
  status        text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  attempts      int not null default 0,
  send_after    timestamptz not null default now(),
  provider_sid  text,
  error         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists outbox_queue_idx on public.outbox(status, send_after);

create table if not exists public.reminder_log (
  key  text primary key,
  at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Row level security: the public can only use the functions below.
--  Staff can read everything; changes go through staff_action().
-- ---------------------------------------------------------------------
alter table public.settings          enable row level security;
alter table public.message_templates enable row level security;
alter table public.staff             enable row level security;
alter table public.applications      enable row level security;
alter table public.documents         enable row level security;
alter table public.guarantors        enable row level security;
alter table public.events            enable row level security;
alter table public.installments      enable row level security;
alter table public.payments          enable row level security;
alter table public.outbox            enable row level security;
alter table public.reminder_log      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','message_templates','staff','applications','documents','guarantors','events','installments','payments','outbox'] loop
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
--  Helpers
-- ---------------------------------------------------------------------
create or replace function public.setting(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key;
$$;

-- Normalise Zimbabwean / international numbers to +E.164
create or replace function public.norm_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p,''), '[^0-9+]', '', 'g');
begin
  if d like '+%' then d := '+' || regexp_replace(d, '[^0-9]', '', 'g');
  elsif d like '00%' then d := '+' || substr(d,3);
  elsif d like '0%' then d := '+263' || substr(d,2);
  elsif d like '263%' then d := '+' || d;
  elsif length(d) = 9 then d := '+263' || d;
  else d := '+' || d;
  end if;
  if length(d) < 10 or length(d) > 16 then return null; end if;
  return d;
end $$;

create or replace function public.new_ref(prefix text) returns text
language sql volatile as $$
  select prefix || '-' || to_char(now() at time zone 'Africa/Harare','YYMMDD') || '-' ||
         upper(substr(encode(extensions.gen_random_bytes(4),'hex'),1,5));
$$;

create or replace function public.money(n numeric) returns text
language sql immutable as $$ select to_char(coalesce(n,0),'FM999,999,990.00') $$;

create or replace function public.render(p_body text, p_vars jsonb) returns text
language plpgsql immutable as $$
declare k text; v text; r text := p_body;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_vars,'{}')) loop
    r := replace(r, '{'||k||'}', coalesce(v,''));
  end loop;
  r := regexp_replace(r, '\{[a-z_]+\}', '', 'g');
  r := regexp_replace(r, '([.!?])\s*\.', '\1', 'g');
  return trim(regexp_replace(r, '\s{2,}', ' ', 'g'));
end $$;

create or replace function public.app_vars(a public.applications) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'first_name', split_part(trim(a.applicant_name),' ',1),
    'name', a.applicant_name,
    'ref', a.ref,
    'product', coalesce(a.product_name, a.product),
    'amount', public.money(a.amount),
    'term', a.term,
    'approved_amount', public.money(coalesce(a.approved_amount,a.amount)),
    'approved_term', coalesce(a.approved_term,a.term),
    'reason', coalesce(a.decision_reason,''),
    'site_url', public.setting('site_url'),
    'office_phone', public.setting('office_phone'));
$$;

-- Queue a templated message for an application (respects client's channel choice)
create or replace function public.enqueue(p_app uuid, p_key text, p_extra jsonb default '{}', p_send_after timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare a public.applications; t public.message_templates; vars jsonb; body text; ch text; n int := 0;
begin
  select * into a from public.applications where id = p_app;
  select * into t from public.message_templates where key = p_key;
  if a.id is null or t.key is null or not t.enabled then return 0; end if;
  vars := public.app_vars(a) || coalesce(p_extra,'{}');
  body := public.render(t.body, vars);
  foreach ch in array (case a.notify_channel when 'both' then array['sms','whatsapp'] else array[a.notify_channel] end) loop
    insert into public.outbox(application_id, template_key, channel, to_phone, body, variables, send_after, created_by)
    values (a.id, p_key, ch, a.mobile, body, vars, p_send_after, auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.log_event(p_app uuid, p_kind text, p_note text, p_visible boolean default false, p_from text default null, p_to text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.events(application_id, actor, actor_name, kind, note, client_visible, status_from, status_to)
  values (p_app, auth.uid(), (select full_name from public.staff where user_id = auth.uid()), p_kind, p_note, p_visible, p_from, p_to);
$$;

-- ---------------------------------------------------------------------
--  PUBLIC: submit an application
-- ---------------------------------------------------------------------
create or replace function public.submit_application(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mobile text := public.norm_phone(p->>'mobile');
  v_amount numeric := nullif(regexp_replace(coalesce(p->>'amount',''),'[^0-9.]','','g'),'')::numeric;
  v_term int := nullif(p->>'term','')::int;
  v_name text := trim(coalesce(p->>'fullName',''));
  v_ch text := coalesce(nullif(p->>'notifyChannel',''),'sms');
  a public.applications;
begin
  if v_name = '' then raise exception 'Please enter your full name.'; end if;
  if v_mobile is null then raise exception 'Please enter a valid mobile number.'; end if;
  if coalesce(p->>'product','') = '' then raise exception 'Please choose a loan.'; end if;
  if v_amount is null or v_amount < public.setting('min_amount')::numeric or v_amount > public.setting('max_amount')::numeric then
    raise exception 'Loan amount must be between US$% and US$%.', public.setting('min_amount'), public.setting('max_amount');
  end if;
  if v_term is null or v_term < public.setting('min_term')::int or v_term > public.setting('max_term')::int then
    raise exception 'Repayment period must be between % and % months.', public.setting('min_term'), public.setting('max_term');
  end if;
  if v_ch not in ('sms','whatsapp','both') then v_ch := 'sms'; end if;
  if (select count(*) from public.applications where mobile = v_mobile and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many applications from this number. Please call us on %.', public.setting('office_phone');
  end if;

  insert into public.applications(ref, product, product_name, is_business, amount, term, loan_type, purpose,
     applicant_name, mobile, email, id_number, notify_channel, guarantor_mode, data, monthly_rate)
  values (public.new_ref('FC'), p->>'product', p->>'productName', coalesce((p->>'isBusiness')::boolean,false),
     v_amount, v_term, p->>'loanType', p->>'purpose', v_name, v_mobile, nullif(p->>'email',''), p->>'idNumber',
     v_ch, p->>'gMode', p - 'agreeCert' - 'agreePrivacy', public.setting('monthly_rate')::numeric)
  returning * into a;

  insert into public.events(application_id, kind, note, client_visible, status_to)
  values (a.id, 'status', 'Application submitted online', true, 'submitted');
  perform public.enqueue(a.id, 'received');
  return jsonb_build_object('id', a.id, 'ref', a.ref, 'upload_token', a.upload_token);
end $$;

-- ---------------------------------------------------------------------
--  PUBLIC: submit a guarantor form
-- ---------------------------------------------------------------------
create or replace function public.submit_guarantor(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mobile text := public.norm_phone(p->>'phone'); g public.guarantors; v_app uuid; v_body text; t public.message_templates;
begin
  if trim(coalesce(p->>'fullName','')) = '' then raise exception 'Please enter your full name.'; end if;
  if v_mobile is null then raise exception 'Please enter a valid phone number.'; end if;
  select id into v_app from public.applications where upper(ref) = upper(trim(coalesce(p->>'applicationRef','')));
  insert into public.guarantors(ref, application_id, application_ref, loanee_name, full_name, mobile, id_number, data)
  values (public.new_ref('FCG'), v_app, nullif(upper(trim(p->>'applicationRef')),''), p->>'loanee', trim(p->>'fullName'), v_mobile, p->>'idNumber', p - 'agree')
  returning * into g;
  if v_app is not null then
    perform public.log_event(v_app, 'document', 'Guarantor form received from '||g.full_name||' ('||g.ref||')');
    update public.applications set client_updated_at = now() where id = v_app;
  end if;
  select * into t from public.message_templates where key='guarantor_received' and enabled;
  if t.key is not null then
    v_body := public.render(t.body, jsonb_build_object('first_name', split_part(g.full_name,' ',1),'ref',g.ref,'loanee',coalesce(g.loanee_name,'the borrower')));
    insert into public.outbox(guarantor_id, application_id, template_key, channel, to_phone, body) values (g.id, v_app, t.key, 'sms', g.mobile, v_body);
  end if;
  return jsonb_build_object('id', g.id, 'ref', g.ref, 'upload_token', g.upload_token, 'linked', v_app is not null);
end $$;

-- Storage policy helper: may this upload folder be written to?
create or replace function public.upload_allowed(p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.applications where upload_token::text = p_folder
                  and status in ('submitted','under_review','more_info','approved'))
      or exists(select 1 from public.guarantors where upload_token::text = p_folder
                  and created_at > now() - interval '7 days');
$$;

-- ---------------------------------------------------------------------
--  PUBLIC: record uploaded documents (after the files are in storage)
-- ---------------------------------------------------------------------
create or replace function public.register_documents(p_token uuid, p_docs jsonb)
returns int language plpgsql security definer set search_path = public, storage as $$
declare a public.applications; g public.guarantors; d jsonb; n int := 0; names text := '';
begin
  select * into a from public.applications where upload_token = p_token;
  if a.id is null then select * into g from public.guarantors where upload_token = p_token; end if;
  if a.id is null and g.id is null then raise exception 'Upload link not recognised.'; end if;
  for d in select * from jsonb_array_elements(p_docs) loop
    if split_part(d->>'path','/',1) <> p_token::text then continue; end if;
    if not exists(select 1 from storage.objects where bucket_id = 'loan-docs' and name = d->>'path') then continue; end if;
    insert into public.documents(application_id, guarantor_id, kind, label, file_path, file_name, size_bytes, mime)
    values (coalesce(a.id, g.application_id), g.id, d->>'kind', d->>'label', d->>'path', d->>'name', (d->>'size')::bigint, d->>'mime')
    on conflict (file_path) do nothing;
    if found then n := n + 1; names := names || case when names='' then '' else ', ' end || coalesce(d->>'label', d->>'kind'); end if;
  end loop;
  if n > 0 and coalesce(a.id, g.application_id) is not null then
    insert into public.events(application_id, kind, note, client_visible)
    values (coalesce(a.id, g.application_id), 'document',
            case when g.id is not null then 'Guarantor uploaded: ' else 'Documents uploaded: ' end || names, g.id is null);
    update public.applications set client_updated_at = now() where id = coalesce(a.id, g.application_id);
  end if;
  return n;
end $$;

-- ---------------------------------------------------------------------
--  PUBLIC: track an application with reference + mobile number
-- ---------------------------------------------------------------------
create or replace function public.track_application(p_ref text, p_mobile text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.applications; v_paid numeric; v_total numeric;
begin
  select * into a from public.applications
   where upper(ref) = upper(trim(p_ref)) and mobile = public.norm_phone(p_mobile);
  if a.id is null then
    perform pg_sleep(0.6);
    return jsonb_build_object('found', false);
  end if;
  select coalesce(sum(amount),0), coalesce(sum(paid_amount),0) into v_total, v_paid from public.installments where application_id = a.id;
  return jsonb_build_object(
    'found', true, 'ref', a.ref, 'status', a.status, 'product', coalesce(a.product_name,a.product),
    'amount', a.amount, 'term', a.term, 'created_at', a.created_at,
    'approved_amount', a.approved_amount, 'approved_term', a.approved_term,
    'reason', case when a.status in ('more_info','approved','rejected') then a.decision_reason end,
    'can_upload', a.status in ('submitted','under_review','more_info','approved'),
    'upload_token', case when a.status in ('submitted','under_review','more_info','approved') then a.upload_token end,
    'notify_channel', a.notify_channel,
    'balance', v_total - v_paid, 'total', v_total,
    'events', coalesce((select jsonb_agg(jsonb_build_object('at',e.at,'note',e.note,'status',e.status_to) order by e.at)
                          from public.events e where e.application_id = a.id and e.client_visible),'[]'),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('label',coalesce(d.label,d.kind),'name',d.file_name,'at',d.uploaded_at,'verified',d.verified) order by d.uploaded_at)
                          from public.documents d where d.application_id = a.id and d.guarantor_id is null),'[]'),
    'installments', coalesce((select jsonb_agg(jsonb_build_object('n',i.n,'due',i.due_date,'amount',i.amount,'paid',i.paid_amount,'status',i.status) order by i.n)
                          from public.installments i where i.application_id = a.id),'[]'));
end $$;

-- ---------------------------------------------------------------------
--  STAFF: every officer action goes through here (audited)
-- ---------------------------------------------------------------------
create or replace function public.staff_action(p_app uuid, p_action text, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.applications; v_old text; v_reason text := nullif(trim(coalesce(p->>'reason','')),'');
  v_amt numeric; v_term int; v_rate numeric; v_total numeric; v_inst numeric; v_first date; i int;
  v_pay numeric; v_left numeric; r record; v_bal numeric; v_paid_on date; v_msg text;
begin
  if not public.is_staff() then raise exception 'Only FastCred staff can do this.'; end if;
  select * into a from public.applications where id = p_app for update;
  if a.id is null then raise exception 'Application not found.'; end if;
  v_old := a.status;

  if p_action = 'assign' then
    update public.applications set assigned_to = coalesce((p->>'user_id')::uuid, auth.uid()), updated_at = now() where id = a.id;
    perform public.log_event(a.id, 'note', 'Assigned to '||coalesce((select full_name from public.staff where user_id = coalesce((p->>'user_id')::uuid, auth.uid())),'officer'));

  elsif p_action = 'review' then
    if v_old not in ('submitted','more_info') then raise exception 'Only new applications can be moved to review.'; end if;
    update public.applications set status='under_review', assigned_to = coalesce(assigned_to, auth.uid()), updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','Application is being reviewed', true, v_old, 'under_review');
    if coalesce((p->>'notify')::boolean, true) then perform public.enqueue(a.id,'under_review'); end if;

  elsif p_action = 'more_info' then
    if v_reason is null then raise exception 'Say what information or documents are needed.'; end if;
    if v_old not in ('submitted','under_review','more_info') then raise exception 'You can only request information before a decision.'; end if;
    update public.applications set status='more_info', decision_reason=v_reason, updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','More information requested: '||v_reason, true, v_old, 'more_info');
    perform public.enqueue(a.id,'more_info');

  elsif p_action = 'approve' then
    if v_old not in ('submitted','under_review','more_info') then raise exception 'This application has already been decided.'; end if;
    v_amt := coalesce(nullif(p->>'amount','')::numeric, a.amount);
    v_term := coalesce(nullif(p->>'term','')::int, a.term);
    if v_term < public.setting('min_term')::int or v_term > public.setting('max_term')::int then raise exception 'Term must be % to % months.', public.setting('min_term'), public.setting('max_term'); end if;
    if v_amt <= 0 then raise exception 'Enter the approved amount.'; end if;
    update public.applications set status='approved', decision_reason=v_reason, approved_amount=v_amt, approved_term=v_term,
           decided_by=auth.uid(), decided_at=now(), updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','Approved: US$'||public.money(v_amt)||' over '||v_term||' month(s)'||coalesce('. '||v_reason,''), true, v_old, 'approved');
    perform public.enqueue(a.id,'approved');

  elsif p_action = 'reject' then
    if v_reason is null then raise exception 'Give the reason for rejecting the application.'; end if;
    if v_old not in ('submitted','under_review','more_info','approved') then raise exception 'This application can no longer be rejected.'; end if;
    update public.applications set status='rejected', decision_reason=v_reason, decided_by=auth.uid(), decided_at=now(), updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','Not approved: '||v_reason, true, v_old, 'rejected');
    perform public.enqueue(a.id,'rejected');

  elsif p_action = 'disburse' then
    if v_old <> 'approved' then raise exception 'Only approved loans can be disbursed.'; end if;
    v_amt := coalesce(a.approved_amount, a.amount); v_term := coalesce(a.approved_term, a.term);
    v_rate := coalesce(a.monthly_rate, public.setting('monthly_rate')::numeric);
    v_total := round(v_amt * (1 + v_rate * v_term), 2);
    v_inst := round(v_total / v_term, 2);
    v_first := coalesce(nullif(p->>'first_due','')::date, (coalesce(nullif(p->>'disbursed_on','')::date, current_date) + interval '1 month')::date);
    delete from public.installments where application_id = a.id;
    for i in 1..v_term loop
      insert into public.installments(application_id, n, due_date, amount)
      values (a.id, i, (v_first + ((i-1) || ' month')::interval)::date,
              case when i = v_term then v_total - v_inst * (v_term-1) else v_inst end);
    end loop;
    update public.applications set status='disbursed', disbursed_on=coalesce(nullif(p->>'disbursed_on','')::date, current_date), updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','Funds released: US$'||public.money(v_amt)||'. Total repayable US$'||public.money(v_total)||' in '||v_term||' instalment(s)', true, v_old, 'disbursed');
    perform public.enqueue(a.id,'disbursed', jsonb_build_object('installment_amount', public.money(v_inst), 'due_date', to_char(v_first,'DD Mon YYYY')));

  elsif p_action = 'payment' then
    if v_old not in ('disbursed') then raise exception 'Payments can only be recorded on disbursed loans.'; end if;
    v_pay := nullif(p->>'amount','')::numeric;
    if v_pay is null or v_pay <= 0 then raise exception 'Enter the amount paid.'; end if;
    v_paid_on := coalesce(nullif(p->>'paid_on','')::date, current_date);
    insert into public.payments(application_id, amount, paid_on, method, reference, recorded_by)
    values (a.id, v_pay, v_paid_on, p->>'method', p->>'reference', auth.uid());
    v_left := v_pay;
    for r in select * from public.installments where application_id=a.id and status<>'paid' order by n loop
      exit when v_left <= 0;
      update public.installments
         set paid_amount = paid_amount + least(v_left, r.amount - r.paid_amount),
             last_paid_on = v_paid_on,
             status = case when paid_amount + least(v_left, r.amount - r.paid_amount) >= amount then 'paid' else status end
       where id = r.id;
      v_left := v_left - least(v_left, r.amount - r.paid_amount);
    end loop;
    select coalesce(sum(amount - paid_amount),0) into v_bal from public.installments where application_id=a.id;
    perform public.log_event(a.id,'payment','Payment received: US$'||public.money(v_pay)||coalesce(' via '||nullif(p->>'method',''),'')||'. Balance US$'||public.money(v_bal), true);
    if v_bal <= 0 then
      update public.applications set status='closed', updated_at=now() where id=a.id;
      perform public.log_event(a.id,'status','Loan fully repaid', true, 'disbursed', 'closed');
      perform public.enqueue(a.id,'loan_closed');
    else
      perform public.enqueue(a.id,'payment_received', jsonb_build_object('paid', public.money(v_pay), 'paid_on', to_char(v_paid_on,'DD Mon YYYY'), 'balance', public.money(v_bal)));
    end if;

  elsif p_action = 'note' then
    if v_reason is null then raise exception 'Write a note.'; end if;
    perform public.log_event(a.id,'note', v_reason, false);

  elsif p_action = 'message' then
    v_msg := nullif(trim(coalesce(p->>'text','')),'');
    if v_msg is null then raise exception 'Write the message to send.'; end if;
    insert into public.outbox(application_id, template_key, channel, to_phone, body, created_by)
    select a.id, 'custom', ch, a.mobile, v_msg, auth.uid()
      from unnest(case coalesce(p->>'channel', a.notify_channel) when 'both' then array['sms','whatsapp'] else array[coalesce(p->>'channel', a.notify_channel)] end) ch;
    perform public.log_event(a.id,'message','Message sent to client: '||v_msg, false);

  elsif p_action = 'verify_doc' then
    update public.documents set verified = coalesce((p->>'verified')::boolean, true), verified_by = auth.uid(), verified_at = now()
     where id = (p->>'document_id')::uuid and (application_id = a.id or guarantor_id in (select id from public.guarantors where application_id = a.id));
    perform public.log_event(a.id,'document', case when coalesce((p->>'verified')::boolean,true) then 'Document verified: ' else 'Document unverified: ' end ||
       coalesce((select coalesce(label,kind) from public.documents where id=(p->>'document_id')::uuid),''), false);

  elsif p_action = 'link_guarantor' then
    update public.guarantors set application_id = a.id where id = (p->>'guarantor_id')::uuid;
    perform public.log_event(a.id,'note','Guarantor form linked', false);

  elsif p_action = 'withdraw' then
    if v_old in ('disbursed','closed') then raise exception 'A disbursed loan cannot be withdrawn.'; end if;
    update public.applications set status='withdrawn', decision_reason=coalesce(v_reason, decision_reason), updated_at=now() where id=a.id;
    perform public.log_event(a.id,'status','Application withdrawn'||coalesce(': '||v_reason,''), true, v_old, 'withdrawn');

  else
    raise exception 'Unknown action %', p_action;
  end if;

  return jsonb_build_object('ok', true, 'status', (select status from public.applications where id = a.id));
end $$;

-- STAFF: edit settings / templates (managers and admins)
create or replace function public.admin_save(p_kind text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.staff_role(),'') not in ('manager','admin') then raise exception 'Only managers and admins can change settings.'; end if;
  if p_kind = 'template' then
    update public.message_templates set body = coalesce(p->>'body', body), enabled = coalesce((p->>'enabled')::boolean, enabled),
           wa_content_sid = case when p ? 'wa_content_sid' then nullif(trim(p->>'wa_content_sid'),'') else wa_content_sid end
     where key = p->>'key';
  elsif p_kind = 'setting' then
    update public.settings set value = p->>'value' where key = p->>'key';
  elsif p_kind = 'staff' then
    if public.staff_role() <> 'admin' then raise exception 'Only admins can manage staff.'; end if;
    insert into public.staff(user_id, full_name, email, role, active)
    select u.id, coalesce(nullif(p->>'full_name',''), u.email), u.email, coalesce(p->>'role','officer'), coalesce((p->>'active')::boolean,true)
      from auth.users u where lower(u.email) = lower(trim(p->>'email'))
    on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role, active = excluded.active;
    if not found then raise exception 'No login exists for %. Create the user first in Supabase → Authentication → Users.', p->>'email'; end if;
  elsif p_kind = 'retry_message' then
    update public.outbox set status='queued', attempts=0, error=null, send_after=now() where id = (p->>'id')::bigint and status in ('failed','cancelled');
  elsif p_kind = 'cancel_message' then
    update public.outbox set status='cancelled' where id = (p->>'id')::bigint and status = 'queued';
  else raise exception 'Unknown setting type'; end if;
end $$;

-- ---------------------------------------------------------------------
--  Sending: Twilio SMS & WhatsApp (credentials live in Supabase Vault)
-- ---------------------------------------------------------------------
create or replace function public.secret(p_name text) returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;
revoke execute on function public.secret(text) from public, anon, authenticated;

create or replace function public.dispatch_outbox(p_limit int default 25) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  m record; sid text := public.secret('twilio_account_sid'); tok text := public.secret('twilio_auth_token');
  sms_from text := public.secret('twilio_sms_from'); wa_from text := public.secret('twilio_whatsapp_from');
  resp record; form jsonb; csid text; n int := 0; auth_h text; j jsonb;
begin
  if coalesce(public.setting('sending_enabled'),'true') <> 'true' then return 0; end if;
  if sid is null or tok is null then
    update public.outbox set error = 'Twilio is not set up yet (add the secrets in Vault).'
     where status='queued' and error is distinct from 'Twilio is not set up yet (add the secrets in Vault).';
    return 0;
  end if;
  auth_h := 'Basic ' || replace(encode(convert_to(sid||':'||tok,'utf8'),'base64'), E'\n', '');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');

  for m in select * from public.outbox where status='queued' and send_after <= now() and attempts < 5
           order by id limit p_limit for update skip locked loop
    update public.outbox set status='sending', attempts=attempts+1 where id=m.id;
    begin
      if m.channel = 'whatsapp' then
        if wa_from is null then raise exception 'WhatsApp sender not set up (twilio_whatsapp_from).'; end if;
        select wa_content_sid into csid from public.message_templates where key = m.template_key;
        form := jsonb_build_object('To','whatsapp:'||m.to_phone, 'From', case when wa_from like 'whatsapp:%' then wa_from else 'whatsapp:'||wa_from end);
        if csid is not null then form := form || jsonb_build_object('ContentSid', csid, 'ContentVariables', coalesce(m.variables,'{}')::text);
        else form := form || jsonb_build_object('Body', m.body); end if;
      else
        if sms_from is null then raise exception 'SMS sender not set up (twilio_sms_from).'; end if;
        form := jsonb_build_object('To', m.to_phone, 'Body', m.body) ||
                case when sms_from like 'MG%' then jsonb_build_object('MessagingServiceSid', sms_from) else jsonb_build_object('From', sms_from) end;
      end if;
      select * into resp from extensions.http((
        'POST', 'https://api.twilio.com/2010-04-01/Accounts/'||sid||'/Messages.json',
        array[extensions.http_header('Authorization', auth_h)],
        'application/x-www-form-urlencoded', extensions.urlencode(form))::extensions.http_request);
      j := case when resp.content ~ '^\s*\{' then resp.content::jsonb else '{}'::jsonb end;
      if resp.status between 200 and 299 then
        update public.outbox set status='sent', sent_at=now(), provider_sid=j->>'sid', error=null where id=m.id;
        n := n + 1;
      else
        raise exception 'Twilio %: %', resp.status, coalesce(j->>'message', left(resp.content,300));
      end if;
    exception when others then
      update public.outbox set
        status = case when attempts >= 5 then 'failed' else 'queued' end,
        error = left(sqlerrm, 500),
        send_after = now() + (attempts * interval '5 minutes')
      where id = m.id;
      -- WhatsApp gave up: fall back to SMS once
      if m.channel='whatsapp' and m.attempts + 1 >= 5 then
        insert into public.outbox(application_id, guarantor_id, template_key, channel, to_phone, body, variables)
        select m.application_id, m.guarantor_id, m.template_key, 'sms', m.to_phone, m.body, m.variables
         where not exists(select 1 from public.outbox o where o.application_id is not distinct from m.application_id
                          and o.template_key is not distinct from m.template_key and o.channel='sms' and o.created_at >= m.created_at);
      end if;
    end;
  end loop;
  return n;
end $$;

-- Daily follow-ups: repayment reminders, overdue notices, missing information
create or replace function public.run_daily_followups(p_today date default (now() at time zone 'Africa/Harare')::date)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_before int := coalesce(public.setting('reminder_days_before'),'3')::int; k text; v_tpl text;
begin
  update public.installments set status='overdue' where status='due' and due_date < p_today;

  for r in select i.*, a.ref from public.installments i join public.applications a on a.id=i.application_id
            where i.status <> 'paid' and a.status='disbursed'
              and i.due_date in (p_today + v_before, p_today, p_today - 1, p_today - 7) loop
    v_tpl := case when r.due_date = p_today + v_before then 'reminder_before'
                  when r.due_date = p_today then 'reminder_due'
                  when r.due_date = p_today - 1 then 'overdue_1'
                  else 'overdue_7' end;
    k := 'inst:'||r.id||':'||v_tpl;
    insert into public.reminder_log(key) values (k) on conflict do nothing;
    if found then
      perform public.enqueue(r.application_id, v_tpl, jsonb_build_object('amount_due', public.money(r.amount - r.paid_amount), 'due_date', to_char(r.due_date,'DD Mon YYYY')));
      insert into public.events(application_id, kind, note) values (r.application_id, 'message', 'Automatic reminder sent: '||v_tpl||' (instalment '||r.n||')');
      n := n + 1;
    end if;
  end loop;

  -- Waiting for client information: remind every 3 days, up to 3 times
  for r in select a.* from public.applications a
            where a.status='more_info' and a.updated_at < now() - interval '3 days'
              and (a.client_updated_at is null or a.client_updated_at < a.updated_at)
              and (select count(*) from public.reminder_log where key like 'info:'||a.id||':%') < 3
              and not exists(select 1 from public.reminder_log where key like 'info:'||a.id||':%' and at > now() - interval '3 days') loop
    insert into public.reminder_log(key) values ('info:'||r.id||':'||p_today) on conflict do nothing;
    perform public.enqueue(r.id, 'more_info_reminder');
    insert into public.events(application_id, kind, note) values (r.id, 'message', 'Automatic reminder: information still needed');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
--  Storage bucket for documents (private)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loan-docs','loan-docs', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "fastcred public upload" on storage.objects;
create policy "fastcred public upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'loan-docs' and public.upload_allowed((storage.foldername(name))[1]));
drop policy if exists "fastcred staff read" on storage.objects;
create policy "fastcred staff read" on storage.objects for select to authenticated
  using (bucket_id = 'loan-docs' and public.is_staff());

-- ---------------------------------------------------------------------
--  Function permissions
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.submit_application(jsonb), public.submit_guarantor(jsonb),
                          public.register_documents(uuid, jsonb), public.track_application(text, text),
                          public.upload_allowed(text) to anon, authenticated;
grant execute on function public.staff_action(uuid, text, jsonb), public.admin_save(text, jsonb),
                          public.is_staff(), public.staff_role() to authenticated;
revoke execute on function public.dispatch_outbox(int), public.run_daily_followups(date), public.secret(text) from authenticated;

-- ---------------------------------------------------------------------
--  Schedules: send every minute, follow-ups every morning 08:00 Harare
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('fastcred-send','fastcred-followups');
select cron.schedule('fastcred-send',      '* * * * *', $$select public.dispatch_outbox()$$);
select cron.schedule('fastcred-followups', '0 6 * * *', $$select public.run_daily_followups()$$);
