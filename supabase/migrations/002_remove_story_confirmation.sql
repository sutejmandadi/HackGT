-- Apply to existing projects. Safe to run when the column is already absent.
begin;
alter table public.stories drop column if exists user_confirmed;
commit;
