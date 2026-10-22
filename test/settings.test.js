import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultControls,loadControls,saveControls,validateControls,instanceTag} from '../settings.js';

test('defaults and persisted settings survive reload',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tesira-settings-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'nested','settings.json');assert.deepEqual(await loadControls(file),defaultControls);
 const c={main:{tag:'Main Level',channels:2,gang:false},sub:{tag:'Sub_Trim',channels:1,gang:true}};
 await saveControls(file,c);assert.deepEqual(await loadControls(file),c);assert.equal(instanceTag('Main Level'),'"Main Level"');
 await writeFile(file,'invalid');await assert.rejects(loadControls(file));
});
test('reject command injection, invalid counts, and missing gang state',()=>{
 for(const patch of [{tag:'Level5\r\nDEVICE reboot'},{tag:' '},{tag:'Level5;anything'},{channels:0},{channels:33},{channels:1.5},{gang:'true'}]){
   assert.throws(()=>validateControls({...defaultControls,main:{...defaultControls.main,...patch}}));
 }
});
