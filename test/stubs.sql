do $$ begin create role anon nologin; exception when others then null; end $$; do $$ begin create role authenticated nologin; exception when others then null; end $$; do $$ begin create role service_role nologin bypassrls; exception when others then null; end $$;
create schema auth; create schema storage; create schema vault; create schema extensions; create schema cron;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant execute on function storage.foldername(text) to anon, authenticated;
create table vault.secrets(name text primary key, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
-- http stub
create type extensions.http_header as (field text, value text);
create type extensions.http_request as (method text, uri text, headers extensions.http_header[], content_type text, content text);
create type extensions.http_response as (status int, content_type text, headers extensions.http_header[], content text);
create table extensions.http_log(at timestamptz default now(), req extensions.http_request);
create function extensions.http_header(f text, v text) returns extensions.http_header language sql as $$ select row(f,v)::extensions.http_header $$;
create function extensions.http_set_curlopt(a text, b text) returns bool language sql as $$ select true $$;
create function extensions.urlencode(j jsonb) returns text language sql as $$ select string_agg(key||'='||replace(value,' ','+'),'&') from jsonb_each_text(j) $$;
create function extensions.http(r extensions.http_request) returns extensions.http_response language plpgsql as $$
begin insert into extensions.http_log(req) values (r);
  if r.content like '%263770000000%' then return row(400,'application/json',null,'{"message":"Invalid To number"}')::extensions.http_response; end if;
  return row(201,'application/json',null,'{"sid":"SM'||md5(random()::text)||'"}')::extensions.http_response; end $$;
create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text),'hex') $$;
create table cron.job(jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns int language sql as $$ insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid $$;
create function cron.unschedule(id int) returns bool language sql as $$ delete from cron.job where jobid=id returning true $$;
