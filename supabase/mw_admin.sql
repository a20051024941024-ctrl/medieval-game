-- 中世紀世界霸權：身分確認、檢舉、管理員、名人堂（v233）
-- 在 Supabase → SQL Editor 整段貼上執行。可以重複執行。

-- 1) 身分確認：每個人只能寫自己的暗號，別人讀不到；房主用 mw_check 確認後就作廢
create table if not exists public.mw_hello (uid uuid primary key, nonce text not null, at timestamptz not null default now());
alter table public.mw_hello enable row level security;
drop policy if exists "hello own insert" on public.mw_hello;
drop policy if exists "hello own update" on public.mw_hello;
create policy "hello own insert" on public.mw_hello for insert to authenticated with check (uid = auth.uid());
create policy "hello own update" on public.mw_hello for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create or replace function public.mw_check(p_uid uuid, p_nonce text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from mw_hello where uid = p_uid and nonce = p_nonce and at > now() - interval '15 minutes';
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function public.mw_check(uuid, text) to authenticated;

-- 2) 管理員名單（只有用 SQL 才能加人）
create table if not exists public.mw_admins (uid uuid primary key);
alter table public.mw_admins enable row level security;
create or replace function public.mw_is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from mw_admins where uid = auth.uid());
$$;
grant execute on function public.mw_is_admin() to authenticated;

-- 3) 檢舉：大家都能送，只有管理員看得到、能標成已處理
create table if not exists public.mw_reports (
  id bigint generated always as identity primary key,
  code text, reporter uuid not null default auth.uid(),
  target_f text, target_name text, reason text, excerpt text, year int,
  handled boolean not null default false, created_at timestamptz not null default now());
alter table public.mw_reports enable row level security;
drop policy if exists "report insert" on public.mw_reports;
drop policy if exists "report admin read" on public.mw_reports;
drop policy if exists "report admin update" on public.mw_reports;
create policy "report insert" on public.mw_reports for insert to authenticated with check (reporter = auth.uid());
create policy "report admin read" on public.mw_reports for select to authenticated using (public.mw_is_admin());
create policy "report admin update" on public.mw_reports for update to authenticated using (public.mw_is_admin());

-- 4) 管理員指令：管理員送出，當時的房主讀取並執行
create table if not exists public.mw_cmds (
  id bigint generated always as identity primary key,
  code text not null, cmd jsonb not null, done boolean not null default false, note text,
  created_at timestamptz not null default now());
alter table public.mw_cmds enable row level security;
drop policy if exists "cmd admin insert" on public.mw_cmds;
drop policy if exists "cmd read" on public.mw_cmds;
drop policy if exists "cmd host done" on public.mw_cmds;
create policy "cmd admin insert" on public.mw_cmds for insert to authenticated with check (public.mw_is_admin());
create policy "cmd read" on public.mw_cmds for select to authenticated using (
  public.mw_is_admin() or exists (select 1 from public.mw_rooms r where r.code = mw_cmds.code and r.info->>'host' = auth.uid()::text));
create policy "cmd host done" on public.mw_cmds for update to authenticated using (
  exists (select 1 from public.mw_rooms r where r.code = mw_cmds.code and r.info->>'host' = auth.uid()::text));

-- 5) 名人堂：大家都能看，只有那一間的房主能寫，每一輪只能寫一次
create table if not exists public.mw_fame (
  code text not null, round bigint not null, data jsonb not null,
  created_at timestamptz not null default now(), primary key (code, round));
alter table public.mw_fame enable row level security;
drop policy if exists "fame read" on public.mw_fame;
drop policy if exists "fame host insert" on public.mw_fame;
create policy "fame read" on public.mw_fame for select using (true);
create policy "fame host insert" on public.mw_fame for insert to authenticated with check (
  exists (select 1 from public.mw_rooms r where r.code = mw_fame.code and r.info->>'host' = auth.uid()::text));

-- 6) 把你自己設成管理員：把下面引號裡換成遊戲裡「我的帳號 ID」那一串，再執行這一行
-- insert into public.mw_admins (uid) values ('貼上你的帳號ID') on conflict do nothing;
