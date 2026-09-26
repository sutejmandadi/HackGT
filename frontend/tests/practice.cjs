/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TypeScript regression harness. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file,stubs={}){const filename=path.resolve(__dirname,'../app',file);const mod=new Module(filename);mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>name in stubs?stubs[name]:require(name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const {compareAttempts,patterns}=load('practice-patterns.ts');
const fixture=i=>({id:String(i),question_id:i%2?'q1':'q2',prompt:'Question?',competency:'leadership',status:'completed',is_mock:false,created_at:`2026-09-${String(10+i).padStart(2,'0')}`,rubric_version:'v1',pipeline_version:'v1',transcript:'I chose a specific approach and tested it.',metrics:{wpm:150,filler_rate:1,numeric_mentions:2,star:Object.fromEntries(['situation','task','actions','result','unknown'].map(k=>[k,{percent:k==='result'?0:25}]))},analysis:{scores:{Overall:60,Specificity:50}},segments:[],duration:60});
(async()=>{
 assert.deepEqual(patterns([fixture(1),fixture(2)]),[]);
 assert.deepEqual(patterns([1,2,3,4,5].map(i=>({...fixture(i),is_mock:true}))),[]);
 assert(patterns([1,2,3,4,5].map(fixture)).some(p=>p.text.includes('result')));
 const before=fixture(1),after={...fixture(3),duration:40,metrics:{...fixture(3).metrics,numeric_mentions:1}};
 assert(compareAttempts(before,after).some(t=>t.includes('shorter')));
 assert(compareAttempts(before,{...after,rubric_version:'v2'})[0].includes('same question'));
 const store=new Map();global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const types=load('practice-types.ts');
 const repo=load('practice-repository.ts',{'./supabase':{cloudConfigured:false},'./practice-types':types});
 const a=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/practice-report.json'),'utf8'));
 assert(types.isAttempt(a)); assert(!types.isAttempt({...a,metrics:{}}));
 repo.saveLocalAttempt(a);repo.saveLocalAttempt(a);assert.equal((await repo.listAttempts()).total,1);
 await repo.deleteAttempt(a.id);assert.equal((await repo.listAttempts()).total,0);
 store.set('mecode.practice-attempts.v1','invalid');await assert.rejects(()=>repo.listAttempts());
 const {POST,GET}=load('api/practice/route.ts');
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;process.env.NODE_ENV='development';
 const req=(body,type='audio/wav')=>new Request('http://localhost/api/practice',{method:'POST',headers:{'content-type':type},body});
 assert.equal((await POST(req('x','text/html'))).status,415);
 assert.equal((await POST(req('x'.repeat(12*1024*1024+1)))).status,413);
 global.fetch=async(_url,options)=>{assert.equal(options.headers['Content-Type'],'audio/wav');return new Response('data: {"type":"stage","stage":"Analyzing"}\n\n',{headers:{'Content-Type':'text/event-stream'}});};
 assert.match(await(await POST(req('audio'))).text(),/Analyzing/);
 process.env.NODE_ENV='production';assert.equal((await GET(new Request('http://localhost/api/practice'))).status,503);
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public';
 assert.equal((await GET(new Request('http://localhost/api/practice'))).status,401);
 global.fetch=async()=>Response.json({detail:'Session expired'},{status:401});
 assert.equal((await GET(new Request('http://localhost/api/practice',{headers:{Authorization:'Bearer bad'}}))).status,401);
 console.log('Practice checks passed: comparison thresholds, version guards, local persistence/retry/delete, malformed storage, upload limits, streaming, and auth gates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
