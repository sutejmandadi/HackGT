begin;
create table public.practice_attempts (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id text not null check (length(question_id) between 1 and 100),
  prompt text not null check (length(prompt) between 5 and 1500),
  competency text not null check (competency in ('leadership','teamwork','problem_solving','failure','ambiguity')),
  linked_story_id uuid references public.stories(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  duration double precision check (duration between 2 and 300),
  transcript text,
  metrics jsonb,
  analysis jsonb,
  pipeline_version text,
  rubric_version text,
  is_mock boolean not null default false,
  error text check (length(error)<=400),
  audio_reference text check (audio_reference is null),
  check (status <> 'completed' or (duration is not null and transcript is not null and metrics is not null and analysis is not null and pipeline_version is not null and rubric_version is not null))
);
create index practice_owner_created_idx on public.practice_attempts(owner_id,created_at desc);
create index practice_question_idx on public.practice_attempts(owner_id,question_id);

create table public.practice_segments (
  attempt_id uuid not null references public.practice_attempts(id) on delete cascade,
  segment_index integer not null check (segment_index between 0 and 2999),
  data jsonb not null check (jsonb_typeof(data)='object'),
  primary key(attempt_id,segment_index)
);
alter table public.practice_attempts enable row level security;
alter table public.practice_segments enable row level security;
revoke all on public.practice_attempts,public.practice_segments from anon,authenticated;
grant select,insert,update,delete on public.practice_attempts,public.practice_segments to authenticated;
create policy "Own attempts" on public.practice_attempts for all to authenticated
 using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "Own transcript segments" on public.practice_segments for all to authenticated
 using (exists(select 1 from public.practice_attempts a where a.id=attempt_id and a.owner_id=(select auth.uid())))
 with check (exists(select 1 from public.practice_attempts a where a.id=attempt_id and a.owner_id=(select auth.uid())));

create function public.check_practice_story_owner() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.linked_story_id is not null and not exists(select 1 from public.stories where id=new.linked_story_id and owner_id=new.owner_id) then
    raise exception 'Linked story must belong to the attempt owner';
  end if;
  return new;
end;
$$;
create trigger practice_story_owner before insert or update of linked_story_id,owner_id on public.practice_attempts
 for each row execute function public.check_practice_story_owner();

-- User-scoped atomic completion: retries cannot partially save or replace a report.
create function public.complete_practice_attempt(report jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare attempt uuid := (report->>'id')::uuid; current_status text;
begin
  select status into current_status from public.practice_attempts where id=attempt and owner_id=auth.uid() for update;
  if not found then raise exception 'Attempt not accessible'; end if;
  if current_status='completed' then return; end if;
  if report->>'status' <> 'completed' or jsonb_typeof(report->'segments') <> 'array' then raise exception 'Invalid report'; end if;
  delete from public.practice_segments where attempt_id=attempt;
  insert into public.practice_segments(attempt_id,segment_index,data)
    select attempt,(s->>'index')::integer,s from jsonb_array_elements(report->'segments') s;
  update public.practice_attempts set status='completed', duration=(report->>'duration')::double precision,
    transcript=report->>'transcript',metrics=report->'metrics',analysis=report->'analysis',
    pipeline_version=report->>'pipeline_version',rubric_version=report->>'rubric_version',
    is_mock=coalesce((report->>'is_mock')::boolean,false),error=null
    where id=attempt and owner_id=auth.uid();
end;
$$;
revoke all on function public.complete_practice_attempt(jsonb) from public,anon;
grant execute on function public.complete_practice_attempt(jsonb) to authenticated;
commit;
