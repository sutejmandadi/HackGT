-- Development verification: no test users, stories, or attempts survive rollback.
begin;
insert into auth.users(id) values ('31000000-0000-4000-8000-000000000001'),('31000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.stories(id,title) values ('32000000-0000-4000-8000-000000000001','Practice test story');
insert into public.practice_attempts(id,question_id,prompt,competency,linked_story_id) values
 ('33000000-0000-4000-8000-000000000001','test','Tell me about leadership.','leadership','32000000-0000-4000-8000-000000000001');
select public.complete_practice_attempt('{"id":"33000000-0000-4000-8000-000000000001","status":"completed","duration":30,"transcript":"I led a test project.","metrics":{"wpm":10},"analysis":{"scores":{"Overall":50}},"pipeline_version":"test","rubric_version":"test","is_mock":true,"segments":[{"index":0,"start":0,"end":3,"text":"I led a test project."}]}');
-- A retry must not overwrite the already completed transcript.
select public.complete_practice_attempt('{"id":"33000000-0000-4000-8000-000000000001","status":"completed","transcript":"Wrong replacement"}');
do $$ begin
 if (select transcript from public.practice_attempts where id='33000000-0000-4000-8000-000000000001') <> 'I led a test project.' then raise exception 'Retry overwrote report'; end if;
 if (select count(*) from public.practice_segments where attempt_id='33000000-0000-4000-8000-000000000001')<>1 then raise exception 'Segment save failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.practice_attempts where id='33000000-0000-4000-8000-000000000001') then raise exception 'Attempt leaked'; end if;
 if exists(select 1 from public.practice_segments where attempt_id='33000000-0000-4000-8000-000000000001') then raise exception 'Transcript leaked'; end if;
 update public.practice_attempts set error='unauthorized' where id='33000000-0000-4000-8000-000000000001'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-owner update allowed'; end if;
 delete from public.practice_attempts where id='33000000-0000-4000-8000-000000000001'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-owner delete allowed'; end if;
 begin
  insert into public.practice_attempts(id,owner_id,question_id,prompt,competency) values ('33000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','test','Forged owner test','leadership');
  raise exception 'Forged owner accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.complete_practice_attempt('{"id":"33000000-0000-4000-8000-000000000001"}');
  raise exception 'Foreign RPC accepted';
 exception when raise_exception then if sqlerrm<>'Attempt not accessible' then raise; end if; end;
 begin
  insert into public.practice_attempts(id,question_id,prompt,competency,linked_story_id) values ('33000000-0000-4000-8000-000000000002','test','Wrong linked story','leadership','32000000-0000-4000-8000-000000000001');
  raise exception 'Foreign story accepted';
 exception when raise_exception then if sqlerrm<>'Linked story must belong to the attempt owner' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
delete from public.practice_attempts where id='33000000-0000-4000-8000-000000000001';
reset role;
do $$ begin
 if exists(select 1 from public.practice_segments where attempt_id='33000000-0000-4000-8000-000000000001') then raise exception 'Delete did not cascade'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.practice_attempts; raise exception 'Anonymous attempt read allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.practice_segments; raise exception 'Anonymous transcript read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
