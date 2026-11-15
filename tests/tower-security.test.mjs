import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../_worker.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript,'+encodeURIComponent(source))).default;
const endpoint='https://warlike-tower.pages.dev/api/login';
const request=(body,headers={})=>new Request(endpoint,{method:'POST',headers:{origin:'https://warlike-tower.pages.dev','content-type':'application/json',...headers},body});

test('Tower rejects JSON arrays, null, primitives, and malformed UTF-8 before upstream login',async()=>{
 const invalid=['[]','null','123','"hello"','{'];
 for(const input of invalid){const response=await worker.fetch(request(input),{});assert.equal(response.status,400,input)}
 const bytes=new Uint8Array([0xc3,0x28]);const response=await worker.fetch(request(bytes),{});assert.equal(response.status,400);
});
test('Tower rejects excessive, invalid-length and compressed login requests',async()=>{
 const cases=[request('{}',{'content-length':'nope'}),request('{}',{'content-encoding':'gzip'}),request(JSON.stringify({login:'a',password:'b',extra:'x'.repeat(3000)}))];
 for(const req of cases){const response=await worker.fetch(req,{});assert.equal(response.status,400)}
});
test('Tower refuses cross-origin login and does not set a session cookie',async()=>{
 const r=await worker.fetch(request('{}',{origin:'https://evil.example'}),{});
 assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);
});
