-- 中世紀世界霸權：推播通知（v236）。在 SQL Editor 整段貼上執行，可以重複執行。
create table if not exists public.mw_push (
  endpoint text primary key, uid uuid not null, sub jsonb not null,
  last_at timestamptz, created_at timestamptz not null default now());
alter table public.mw_push enable row level security;
drop policy if exists "push own insert" on public.mw_push;
drop policy if exists "push own update" on public.mw_push;
drop policy if exists "push own delete" on public.mw_push;
drop policy if exists "push own read" on public.mw_push;
create policy "push own insert" on public.mw_push for insert to authenticated with check (uid = auth.uid());
create policy "push own update" on public.mw_push for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create policy "push own delete" on public.mw_push for delete to authenticated using (uid = auth.uid());
create policy "push own read" on public.mw_push for select to authenticated using (uid = auth.uid());
-- 通知用的金鑰：由伺服器程式自動產生，玩家讀不到
create table if not exists public.mw_vapid (id int primary key, pub text not null, priv text not null);
alter table public.mw_vapid enable row level security;
