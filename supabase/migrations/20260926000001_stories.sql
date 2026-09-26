-- Run once in your Supabase project's SQL Editor before enabling cloud mode.
begin;
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  organization text not null default '',
  role text not null default '',
  situation text not null default '',
  task text not null default '',
  actions text not null default '',
  result text not null default '',
  source text not null default 'manual' check (source in ('manual', 'resume')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stories_owner_created_idx on public.stories(owner_id, created_at);
alter table public.stories enable row level security;
revoke all on public.stories from anon, authenticated;
grant select, insert, update, delete on public.stories to authenticated;

create policy "Read own stories" on public.stories for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Create own stories" on public.stories for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Update own stories" on public.stories for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own stories" on public.stories for delete to authenticated
  using ((select auth.uid()) = owner_id);

create function public.stamp_story_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.created_at = old.created_at;
  return new;
end;
$$;
create trigger stories_updated before update on public.stories
  for each row execute function public.stamp_story_update();
commit;

