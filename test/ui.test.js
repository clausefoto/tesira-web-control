import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Exercise asynchronous UI behavior with a minimal DOM and controlled HTTP replies.
function dashboard() {
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{disabled:true,textContent:'',value:0,dataset:{},attrs:{},append(){},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}});return elements.get(id);};
 const inputs=['main','sub'].map(element),buttons=[];
 const document={hidden:false,querySelector:s=>element(s.slice(1)),getElementById:element,createElement:()=>({append(){},set innerHTML(v){}}),querySelectorAll:s=>s==='[data-delta]'?buttons:inputs};
 const requests=[];
 const context=vm.createContext({document,setInterval(){},fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,reply:data=>resolve({ok:true,json:async()=>data})}))});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 const data={main:Array(6).fill(-6),sub:12,levels:{main:Array(6).fill(-6),sub:[12]},controls:{main:{tag:'Level5',channels:6,gang:true},sub:{tag:'Level4',channels:1,gang:true}},settingsKey:'original',limits:{main:{min:-24,max:12},sub:{min:-100,max:12}}};
 return {context,requests,element,data};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('background reads leave sliders enabled and cannot overwrite a drag',async()=>{
 const d=dashboard();d.requests.shift().reply(d.data);await settle();assert.equal(d.element('main').disabled,false);
 vm.runInContext('refresh()',d.context);assert.equal(d.element('main').disabled,false);
 d.element('main').onpointerdown();d.element('main').value=-9;d.element('main').oninput();
 d.requests.shift().reply(d.data);await settle();assert.equal(d.element('main').value,-9);
});
test('a write during a background read is sent and stale reads are ignored',async()=>{
 const d=dashboard();d.requests.shift().reply(d.data);await settle();
 vm.runInContext('refresh()',d.context);const read=d.requests.shift();
 d.element('main').value=-7;d.element('main').onchange();
 const write=d.requests.shift();assert.equal(write.path,'/api/volume');assert.equal(JSON.parse(write.options.body).value,-7);
 write.reply({...d.data,main:Array(6).fill(-7),levels:{main:Array(6).fill(-7),sub:[12]}});await settle();read.reply(d.data);await settle();
 assert.equal(d.element('main').value,-7);assert.equal(d.element('main').disabled,false);
});

test('unganged layout targets one channel and includes its mapping identity',async()=>{
 const d=dashboard();
 const data={...d.data,controls:{...d.data.controls,main:{tag:'Level5',channels:2,gang:false}},levels:{main:[-6,-9],sub:[12]}};
 d.requests.shift().reply(data);await settle();
 assert.equal(d.element('main-2').value,-9);d.element('main-2').value=-10;d.element('main-2').onchange();
 const write=d.requests.shift();assert.deepEqual(JSON.parse(write.options.body),{control:'main',value:-10,channel:2,settingsKey:'original'});
 write.reply({...data,levels:{main:[-6,-10],sub:[12]}});await settle();
});
