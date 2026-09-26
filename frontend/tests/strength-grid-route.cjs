/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness compiles the route in isolation for Node tests. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const filename = path.join(root, 'app/api/strength-grid/route.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module(filename); mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled, filename);
const { POST } = mod.exports;
const request = (body) => new Request('http://localhost/api/strength-grid', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async () => {
  process.env.NODE_ENV = 'development';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.equal((await POST(request({stories:[]}))).status,400);
  assert.equal((await POST(request({stories:[null]}))).status,400);
  const story={id:'s1',title:'Example',situation:'Context',task:'Task',actions:'Actions',result:'Result'};
  const expected={scores:[{id:'s1'}]};
  global.fetch=async (url,options)=>{assert.match(url,/\/api\/strength-grid\/score-batch$/); assert.deepEqual(JSON.parse(options.body).stories,[story]); return Response.json(expected);};
  assert.deepEqual(await (await POST(request({stories:[story]}))).json(),expected);
  global.fetch=async()=>{throw new Error('offline')};
  assert.equal((await POST(request({stories:[story]}))).status,503);
  process.env.NODE_ENV='production';
  assert.equal((await POST(request({stories:[story]}))).status,503);
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test';
  assert.equal((await POST(request({stories:[story]}))).status,401);
  console.log('6 route checks passed: invalid inputs, forwarding, offline service, production configuration, missing authentication.');
})().catch(error=>{console.error(error);process.exitCode=1});


