import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

async function start(settingsFile){
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',SETTINGS_FILE:settingsFile}});
 let stderr='';child.stderr.on('data',b=>stderr+=b);
 const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill();reject(Error('Server startup timed out'));},4000);
   child.once('exit',()=>{clearTimeout(timer);reject(Error(stderr||'Server exited'));});
   child.stdout.once('data',b=>{clearTimeout(timer);resolve(Number(String(b).match(/on (\d+)/)[1]));});
 });
 return {child,url:`http://127.0.0.1:${port}`,stop:()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();})};
}
test('settings API validates, persists across restart, and rejects stale writes',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tesira-server-'));let app;
 t.after(async()=>{if(app && app.child.exitCode===null)await app.stop();await rm(dir,{recursive:true,force:true});});
 const file=join(dir,'settings.json');app=await start(file);
 const before=await(await fetch(app.url+'/api/settings')).json();
 const config={main:{tag:'My Main',channels:2,gang:false},sub:{tag:'Subwoofer',channels:2,gang:true}};
 const post=(path,data,headers={})=>fetch(app.url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await post('/api/settings',{controls:config},{Origin:'https://other.example'})).status,403);
 assert.equal((await post('/api/settings',{controls:{...config,main:{...config.main,channels:0}}})).status,400);
 assert.equal((await post('/api/settings',{controls:config})).status,200);
 assert.equal((await post('/api/volume',{control:'main',channel:1,value:-10,settingsKey:before.settingsKey})).status,400);
 await app.stop();app=await start(file);
 assert.deepEqual((await(await fetch(app.url+'/api/settings')).json()).controls,config);
 assert.equal((await fetch(app.url+'/')).status,200);
});
