\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
-- staff user
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','officer@fastcred.co.zw'),('22222222-2222-2222-2222-222222222222','random@x.com');
insert into public.staff(user_id, full_name, email, role) values ('11111111-1111-1111-1111-111111111111','Rudo Officer','officer@fastcred.co.zw','admin');
insert into vault.secrets values ('twilio_account_sid','ACtest'),('twilio_auth_token','tok'),('twilio_sms_from','+15550001111'),('twilio_whatsapp_from','+14155238886');

-- ===== PUBLIC (anon) =====
set role anon;
\echo '--- anon cannot read tables'
do $$ begin perform * from public.applications; raise exception 'LEAK'; exception when insufficient_privilege then raise notice 'blocked ok'; end $$;
\echo '--- bad amount rejected'
do $$ begin perform public.submit_application('{"fullName":"T Moyo","mobile":"0771234567","product":"working-capital","amount":"50000","term":"3"}'); raise exception 'NO VALIDATION'; exception when others then raise notice 'rejected: %', sqlerrm; end $$;
\echo '--- bad term rejected'
do $$ begin perform public.submit_application('{"fullName":"T Moyo","mobile":"0771234567","product":"working-capital","amount":"500","term":"6"}'); raise exception 'NO VALIDATION'; exception when others then raise notice 'rejected: %', sqlerrm; end $$;
select set_config('t.r', public.submit_application('{"fullName":"Tendai Moyo","mobile":"077 123 4567","product":"working-capital","productName":"SME Working Capital","isBusiness":true,"amount":"2,000","term":"4","loanType":"New","purpose":"Restocking","notifyChannel":"both","agreeCert":true}')::text, false);
select 'submitted: '||current_setting('t.r');
-- upload as anon to the token folder
\echo '--- storage policy: own folder allowed, random folder denied'
select set_config('t.tok', (current_setting('t.r')::jsonb)->>'upload_token', false);
insert into storage.objects(bucket_id,name) values ('loan-docs', current_setting('t.tok')||'/id/1-id.jpg'), ('loan-docs', current_setting('t.tok')||'/statements/1-st.pdf');
do $$ begin insert into storage.objects(bucket_id,name) values ('loan-docs','00000000-0000-0000-0000-000000000000/id/x.jpg'); raise exception 'UPLOAD LEAK'; exception when insufficient_privilege then raise notice 'random folder blocked ok'; end $$;
select 'registered docs: '||public.register_documents(current_setting('t.tok')::uuid, jsonb_build_array(
  jsonb_build_object('kind','id','label','Copy of ID','path',current_setting('t.tok')||'/id/1-id.jpg','name','id.jpg','size',1000,'mime','image/jpeg'),
  jsonb_build_object('kind','statements','label','Bank statements','path',current_setting('t.tok')||'/statements/1-st.pdf','name','st.pdf','size',2000,'mime','application/pdf'),
  jsonb_build_object('kind','fake','path','someoneelse/x.pdf')));
\echo '--- track with wrong phone / right phone'
select public.track_application((current_setting('t.r')::jsonb)->>'ref','0779999999');
select (public.track_application(lower((current_setting('t.r')::jsonb)->>'ref'),'+263771234567')::jsonb) - 'events' - 'upload_token';
\echo '--- guarantor'
select public.submit_guarantor(jsonb_build_object('fullName','Farai Guarantor','phone','0772223333','loanee','Tendai Moyo','applicationRef',(current_setting('t.r')::jsonb)->>'ref','agree',true)) - 'upload_token' - 'id';
\echo '--- anon cannot use staff action'
do $$ begin perform public.staff_action(((current_setting('t.r')::jsonb)->>'id')::uuid,'approve','{}'); raise exception 'STAFF LEAK'; exception when insufficient_privilege then raise notice 'blocked ok'; end $$;
reset role;

-- ===== non-staff logged in user =====
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '--- non-staff sees 0 applications'
select count(*) from public.applications;
do $$ begin perform public.staff_action(((current_setting('t.r')::jsonb)->>'id')::uuid,'approve','{}'); raise exception 'STAFF LEAK'; exception when others then raise notice 'non-staff: %', sqlerrm; end $$;

-- ===== officer =====
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '--- officer sees apps'
select count(*) from public.applications;
select set_config('t.id',(current_setting('t.r')::jsonb)->>'id',false);
\echo '--- reject without reason blocked'
do $$ begin perform public.staff_action(current_setting('t.id')::uuid,'reject','{}'); raise exception 'NO CHECK'; exception when others then raise notice '%', sqlerrm; end $$;
select public.staff_action(current_setting('t.id')::uuid,'review','{}');
select public.staff_action(current_setting('t.id')::uuid,'more_info','{"reason":"a clearer copy of your ID"}');
select public.staff_action(current_setting('t.id')::uuid,'approve','{"amount":"1500","term":"3","reason":"Approved at a lower amount based on your sales records."}');
select public.staff_action(current_setting('t.id')::uuid,'disburse','{"disbursed_on":"2026-10-28","first_due":"2026-11-28"}');
\echo '--- schedule (1500 * 1.3 = 1950 / 3 = 650)'
select n||' '||due_date||' '||amount from public.installments where application_id=current_setting('t.id')::uuid order by n;
select public.staff_action(current_setting('t.id')::uuid,'payment','{"amount":"700","method":"EcoCash","paid_on":"2026-11-27"}');
select n||' paid '||paid_amount||' '||status from public.installments where application_id=current_setting('t.id')::uuid order by n;
reset role;

\echo '--- daily followups: reminder 3 days before inst 2 (due 2026-12-28) on 2026-12-25, then overdue'
select 'followups '||public.run_daily_followups('2026-12-25');
select 'followups again (no dup) '||public.run_daily_followups('2026-12-25');
select 'due day '||public.run_daily_followups('2026-12-28');
select 'overdue1 '||public.run_daily_followups('2026-12-29');
select n||' '||status from public.installments where application_id=current_setting('t.id')::uuid order by n;

\echo '--- dispatch'
select 'sent '||public.dispatch_outbox(100);
select channel||' '||status||' '||coalesce(template_key,'')||' :: '||left(body,90) from public.outbox order by id;
select 'http calls '||count(*) from extensions.http_log;
select (req).content from extensions.http_log limit 1;

\echo '--- failing number retries then WhatsApp falls back to SMS'
update public.applications set mobile='+263770000000' where id=current_setting('t.id')::uuid;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.staff_action(current_setting('t.id')::uuid,'message','{"text":"Test message","channel":"whatsapp"}');
reset role;
do $$ begin for i in 1..5 loop update public.outbox set send_after=now() where status='queued'; perform public.dispatch_outbox(); end loop; end $$;
select channel||' '||status||' attempts='||attempts||' '||coalesce(error,'') from public.outbox where to_phone='+263770000000' order by id;

\echo '--- pay off -> closed'
update public.applications set mobile='+263771234567' where id=current_setting('t.id')::uuid;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.staff_action(current_setting('t.id')::uuid,'payment','{"amount":"1250","method":"Cash"}');
\echo '--- public tracking after close'
reset role; set role anon;
select jsonb_pretty(public.track_application((current_setting('t.r')::jsonb)->>'ref','0771234567')::jsonb - 'upload_token' - 'documents');
reset role;
\echo '--- reject path on second app'
set role anon; select set_config('t.r2', public.submit_application('{"fullName":"Chipo N","mobile":"+263712000111","product":"emergency","amount":"100","term":"1","notifyChannel":"sms"}')::text,false); reset role;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.staff_action(((current_setting('t.r2')::jsonb)->>'id')::uuid,'reject','{"reason":"Your net salary is too low for this repayment."}');
reset role;
select body from public.outbox where template_key='rejected';
\echo '--- more_info reminder'
update public.applications set status='more_info', decision_reason='your latest payslip', updated_at=now()-interval '4 days' where id=((current_setting('t.r2')::jsonb)->>'id')::uuid;
select 'info reminders '||public.run_daily_followups();
select body from public.outbox where template_key='more_info_reminder';
