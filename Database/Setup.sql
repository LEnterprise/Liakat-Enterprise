-- ============================================================================
-- Liakat Enterprise: database setup for Supabase
-- ----------------------------------------------------------------------------
-- HOW TO RUN
--   1. Supabase dashboard > SQL Editor > New query.
--   2. Change the admin email on the LAST lines of this file to your own.
--   3. Paste this whole file and press Run. You can run it again safely.
--
-- WHAT IT BUILDS
--   listings, removed_listings, project_updates   public can read, admins can change
--   quote_requests, variation_orders, payment_plans   private: only admins can read;
--        visitors can only use the small functions further down (send a quote,
--        send / look up / withdraw their own variation request, open a payment
--        plan with its access code, report a payment)
--   listing-photos (storage bucket)               public can view, admins can upload
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Who is an admin
--    Create the login itself in Authentication > Users; this table says which
--    of those accounts count as admins.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  email text primary key
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. Tables
--    Every table keeps the whole record as JSON in "data", plus the key and the
--    time it was created.
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.removed_listings (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_updates (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_requests (
  quote_no   text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.variation_order_seq;

create table if not exists public.variation_orders (
  id         text primary key,
  token      text not null,            -- secret kept by the client's browser
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_plans (
  id          text primary key,
  access_code text not null,           -- given to the client by the admin
  data        jsonb not null,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 3. Access rules (Row Level Security)
-- ---------------------------------------------------------------------------
alter table public.admin_users       enable row level security;
alter table public.listings          enable row level security;
alter table public.removed_listings  enable row level security;
alter table public.project_updates   enable row level security;
alter table public.quote_requests    enable row level security;
alter table public.variation_orders  enable row level security;
alter table public.payment_plans     enable row level security;

-- Start from nothing, then give back only what is needed
revoke all on public.admin_users, public.listings, public.removed_listings, public.project_updates,
              public.quote_requests, public.variation_orders, public.payment_plans from anon;
revoke all on public.admin_users, public.listings, public.removed_listings, public.project_updates,
              public.quote_requests, public.variation_orders, public.payment_plans from authenticated;

grant select on public.listings, public.removed_listings, public.project_updates to anon;
grant select, insert, update, delete on public.listings, public.removed_listings, public.project_updates,
              public.quote_requests, public.variation_orders, public.payment_plans to authenticated;
grant select on public.admin_users to authenticated;

-- Public pages: everyone can read, only admins can change
drop policy if exists "Anyone can read listings" on public.listings;
create policy "Anyone can read listings" on public.listings
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage listings" on public.listings;
create policy "Admins manage listings" on public.listings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read removed listings" on public.removed_listings;
create policy "Anyone can read removed listings" on public.removed_listings
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage removed listings" on public.removed_listings;
create policy "Admins manage removed listings" on public.removed_listings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read project updates" on public.project_updates;
create policy "Anyone can read project updates" on public.project_updates
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage project updates" on public.project_updates;
create policy "Admins manage project updates" on public.project_updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private tables: admins only (visitors go through the functions below)
drop policy if exists "Admins manage quote requests" on public.quote_requests;
create policy "Admins manage quote requests" on public.quote_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage variation orders" on public.variation_orders;
create policy "Admins manage variation orders" on public.variation_orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage payment plans" on public.payment_plans;
create policy "Admins manage payment plans" on public.payment_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can see the admin list" on public.admin_users;
create policy "Admins can see the admin list" on public.admin_users
  for select to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. Functions visitors are allowed to call
--    Each one does a single, limited job and checks what it is given.
-- ---------------------------------------------------------------------------

-- Send a quote request
create or replace function public.quote_submit(p_quote_no text, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quote_no is null or p_quote_no !~ '^LQ-[0-9]{6}-[A-Z0-9]{4}$' then
    raise exception 'Invalid quote number';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 30000 then
    raise exception 'Invalid quote request';
  end if;

  insert into public.quote_requests (quote_no, data)
  values (
    p_quote_no,
    jsonb_set(jsonb_set(p_data, '{status}', '"New"'), '{quoteNo}', to_jsonb(p_quote_no))
  );
  return p_quote_no;
end;
$$;

-- Send a variation request; the database hands out the VO number
create or replace function public.vo_submit(p_token text, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 100 then
    raise exception 'Invalid request';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 30000 then
    raise exception 'Invalid request';
  end if;

  v_id := 'VO-' || lpad(nextval('public.variation_order_seq')::text, 3, '0');
  insert into public.variation_orders (id, token, data)
  values (
    v_id,
    p_token,
    jsonb_set(jsonb_set(p_data, '{id}', to_jsonb(v_id)), '{status}', '"Pending Approval"')
  );
  return v_id;
end;
$$;

-- A client's own variation requests (found by the secret tokens their browser kept)
create or replace function public.vo_get(p_tokens text[])
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data
  from public.variation_orders
  where token = any(p_tokens)
  order by created_at desc;
$$;

-- A client withdraws their own request (only while it is still open)
create or replace function public.vo_withdraw(p_id text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  update public.variation_orders
     set data = jsonb_set(data, '{status}', '"Withdrawn"')
   where id = p_id
     and token = p_token
     and data ->> 'status' in ('Pending Approval', 'In Review')
  returning data into v_data;
  return v_data;
end;
$$;

-- Open a payment plan with its number and access code
create or replace function public.plan_get(p_id text, p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data - 'accessCode'
  from public.payment_plans
  where id = upper(trim(p_id))
    and access_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- A client reports a payment they made (it stays "Reported" until an admin confirms it)
create or replace function public.plan_report(
  p_id text, p_code text, p_item text, p_method text, p_date text, p_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id text;
  v_data    jsonb;
  v_items   jsonb;
begin
  select id, data into v_plan_id, v_data
  from public.payment_plans
  where id = upper(trim(p_id))
    and access_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;

  if v_plan_id is null then
    raise exception 'Payment plan not found';
  end if;
  if jsonb_typeof(v_data -> 'items') is distinct from 'array' then
    raise exception 'Payment plan has no payments';
  end if;

  select coalesce(
           jsonb_agg(
             case
               when t.it ->> 'id' = p_item
                    and coalesce(t.it ->> 'status', 'Pending') in ('Pending', 'Reported')
               then t.it || jsonb_build_object(
                      'status',     'Reported',
                      'method',     left(coalesce(p_method, ''), 40),
                      'paidDate',   left(coalesce(p_date, ''), 10),
                      'reference',  left(coalesce(p_ref, ''), 80),
                      'reportedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                    )
               else t.it
             end
             order by t.ord
           ),
           '[]'::jsonb
         )
    into v_items
  from jsonb_array_elements(v_data -> 'items') with ordinality as t(it, ord);

  v_data := jsonb_set(v_data, '{items}', v_items);
  update public.payment_plans set data = v_data where id = v_plan_id;
  return v_data - 'accessCode';
end;
$$;

-- Only these functions are callable from the website
revoke all on function public.quote_submit(text, jsonb)                              from public;
revoke all on function public.vo_submit(text, jsonb)                                 from public;
revoke all on function public.vo_get(text[])                                         from public;
revoke all on function public.vo_withdraw(text, text)                                from public;
revoke all on function public.plan_get(text, text)                                   from public;
revoke all on function public.plan_report(text, text, text, text, text, text)        from public;
grant execute on function public.quote_submit(text, jsonb)                           to anon, authenticated;
grant execute on function public.vo_submit(text, jsonb)                              to anon, authenticated;
grant execute on function public.vo_get(text[])                                      to anon, authenticated;
grant execute on function public.vo_withdraw(text, text)                             to anon, authenticated;
grant execute on function public.plan_get(text, text)                                to anon, authenticated;
grant execute on function public.plan_report(text, text, text, text, text, text)     to anon, authenticated;
grant execute on function public.is_admin()                                          to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Photo storage for listings
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view listing photos" on storage.objects;
create policy "Anyone can view listing photos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists "Admins upload listing photos" on storage.objects;
create policy "Admins upload listing photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and public.is_admin());

drop policy if exists "Admins change listing photos" on storage.objects;
create policy "Admins change listing photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin())
  with check (bucket_id = 'listing-photos' and public.is_admin());

drop policy if exists "Admins delete listing photos" on storage.objects;
create policy "Admins delete listing photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin());


-- ---------------------------------------------------------------------------
-- 6. YOUR ADMIN EMAIL: change this to the email of the user you created in
--    Authentication > Users, then run the file. Add more lines for more admins.
-- ---------------------------------------------------------------------------
insert into public.admin_users (email) values ('adminlenterprise@gmail.com')
on conflict (email) do nothing;
