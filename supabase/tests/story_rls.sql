-- Development project only. All fixtures are rolled back.
begin;
insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.stories(id, owner_id, title) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS test');
update public.stories set situation = 'Owner can edit' where id = '20000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.stories where id = '20000000-0000-4000-8000-000000000001' and situation = 'Owner can edit') <> 1 then
   raise exception 'Owner read/update failed';
 end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare affected integer; begin
 if exists(select 1 from public.stories where id = '20000000-0000-4000-8000-000000000001') then
   raise exception 'Cross-user read leaked a story';
 end if;
 update public.stories set title = 'Unauthorized' where id = '20000000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Cross-user update allowed'; end if;
 delete from public.stories where id = '20000000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Cross-user delete allowed'; end if;
 begin
   insert into public.stories(owner_id, title) values ('10000000-0000-4000-8000-000000000001', 'Forged owner');
   raise exception 'Forged owner insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
 begin
   update public.stories set owner_id = '10000000-0000-4000-8000-000000000002' where id = '20000000-0000-4000-8000-000000000001';
   raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null;
 end;
 delete from public.stories where id = '20000000-0000-4000-8000-000000000001';
 if not found then raise exception 'Owner delete failed'; end if;
end $$;

reset role;
set local role anon;
do $$ begin
 begin
   perform 1 from public.stories;
   raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
