const controls=document.querySelector('#controls');
const defaults={main:{tag:'Level5',channels:6,gang:true},sub:{tag:'Level4',channels:1,gang:true}};
let current,busy=false,reading=false,editing=false,online=false,revision=0,layoutKey='',rows=[];
const titles={main:'Main volume',sub:'Subwoofer'};
function build(config) {
  const key=JSON.stringify(config);if(key===layoutKey)return;layoutKey=key;rows=[];controls.innerHTML='';
  for(const group of ['main','sub']){
    const c=config[group],card=document.createElement('section');card.className='card';controls.append(card);
    const heading=document.createElement('h2');heading.textContent=titles[group];card.append(heading);
    const hint=document.createElement('p');hint.className='hint';hint.id=`${group}-hint`;card.append(hint);
    for(const channel of c.gang?[undefined]:Array.from({length:c.channels},(_,i)=>i+1)){
      const id=channel===undefined?group:`${group}-${channel}`,title=channel===undefined?titles[group]:`${titles[group]} channel ${channel}`;
      const row=document.createElement('div');row.className='channel';
      row.innerHTML=`<div class="row"><span>${channel===undefined?'Level':`Channel ${channel}`}</span><div><output class="value" id="${id}-value">—</output> <span class="unit">dB</span></div></div><input type="range" id="${id}" step="0.5" aria-label="${title}" disabled><div class="range-labels"><span id="${id}-min"></span><span id="${id}-max"></span></div><div class="adjust"><button id="${id}-down" aria-label="Decrease ${title}" disabled>−</button><button id="${id}-up" aria-label="Increase ${title}" disabled>+</button></div>`;
      card.append(row);rows.push({id,group,channel});
      const slider=document.getElementById(id);
      slider.onpointerdown=()=>{editing=true;};slider.onpointerup=()=>{editing=false;};slider.onblur=()=>{editing=false;};
      slider.oninput=()=>{editing=true;document.getElementById(`${id}-value`).textContent=Number(slider.value).toFixed(1);};
      slider.onchange=()=>{editing=false;write(group,Number(slider.value),channel);};
      slider.onpointercancel=()=>{editing=false;refresh();};
      for(const [suffix,delta]of [['down',-.5],['up',.5]])document.getElementById(`${id}-${suffix}`).onclick=()=>{
        if(!current)return;const values=current.levels[group],value=values[channel===undefined?0:channel-1],limit=current.limits[group];
        write(group,Math.max(limit.min,Math.min(limit.max,value+delta)),channel);
      };
    }
  }
}
function enable(){document.querySelectorAll('#controls button, #controls input').forEach(el=>el.disabled=busy||!online);}
function fillSettings(config){
  for(const key of ['main','sub']){
    document.getElementById(`${key}-tag`).value=config[key].tag;
    document.getElementById(`${key}-channels`).value=config[key].channels;
    const gang=document.getElementById(`${key}-gang`);gang.setAttribute('aria-checked',String(config[key].gang));gang.textContent=config[key].gang?'Gang: On':'Gang: Off';
  }
}
function render(data){
  build(data.controls);current=data;
  for(const {id,group,channel}of rows){
    const values=data.levels[group],value=values[channel===undefined?0:channel-1],limits=data.limits[group];
    const slider=document.getElementById(id);slider.min=limits.min;slider.max=limits.max;slider.value=value;
    document.getElementById(`${id}-value`).textContent=value.toFixed(1);
    document.getElementById(`${id}-min`).textContent=`${limits.min} dB`;
    document.getElementById(`${id}-max`).textContent=`${limits.max} dB`;
  }
  for(const key of ['main','sub']){
    const c=data.controls[key],values=data.levels[key];
    document.getElementById(`${key}-hint`).textContent=c.gang&&values.some(v=>Math.abs(v-values[0])>.01)?`Channels differ: ${values.join(', ')} dB. Adjusting sets all ${c.channels} equally.`:c.gang?`${c.tag} · ${c.channels===1?'Channel 1':`Channels 1–${c.channels} linked`}`:`${c.tag} · Individual channel controls`;
  }
}
async function request(path,options){const res=await fetch(path,options);const data=await res.json();if(!res.ok)throw new Error(data.error||'Connection failed');return data;}
async function run(action){
  if(busy)return;revision++;busy=true;enable();document.getElementById('error').textContent='';
  try{render(await action());online=true;document.getElementById('status').textContent='● Connected · Levels synchronized';}
  catch(e){online=false;document.getElementById('status').textContent='Disconnected · Controls paused';document.getElementById('error').textContent=e.message;}
  finally{busy=false;enable();}
}
async function refresh(){
  if(editing||busy||reading)return;reading=true;const started=revision;
  try{
    const data=await request('/api/state');
    if(started!==revision||editing||busy)return;
    render(data);online=true;document.getElementById('status').textContent='● Connected · Levels synchronized';document.getElementById('error').textContent='';
  }catch(e){
    if(started!==revision||busy)return;
    online=false;document.getElementById('status').textContent='Disconnected · Controls paused';document.getElementById('error').textContent=e.message;
  }finally{reading=false;enable();}
}
function write(control,value,channel){
  if(!current)return;
  run(()=>request('/api/volume',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({control,value,channel,settingsKey:current.settingsKey})}));
}
for(const key of ['main','sub']){
  const select=document.getElementById(`${key}-channels`);
  for(let n=1;n<=32;n++){const option=document.createElement('option');option.value=n;option.textContent=n;select.append(option);}
  const gang=document.getElementById(`${key}-gang`);
  gang.onclick=()=>{const on=gang.getAttribute('aria-checked')!=='true';gang.setAttribute('aria-checked',String(on));gang.textContent=on?'Gang: On':'Gang: Off';};
}
document.getElementById('settings-toggle').onclick=async()=>{
  const panel=document.getElementById('settings-panel');panel.hidden=!panel.hidden;
  if(!panel.hidden){
    try{fillSettings((await request('/api/settings')).controls);document.getElementById('settings-result').textContent='';}
    catch(e){document.getElementById('settings-result').textContent=e.message;}
  }
};
document.getElementById('settings-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const config={};for(const key of ['main','sub'])config[key]={tag:document.getElementById(`${key}-tag`).value,channels:Number(document.getElementById(`${key}-channels`).value),gang:document.getElementById(`${key}-gang`).getAttribute('aria-checked')==='true'};
  revision++;busy=true;enable();document.getElementById('settings-save').disabled=true;
  try{
    const data=await request('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({controls:config})});
    build(data.controls);current=undefined;online=false;
    document.getElementById('settings-result').textContent='Settings saved. Reading DSP levels…';
  }catch(e){document.getElementById('settings-result').textContent=e.message;}
  finally{busy=false;enable();document.getElementById('settings-save').disabled=false;refresh();}
};
document.getElementById('retry').onclick=()=>{editing=false;refresh();};
fillSettings(defaults);build(defaults);
setInterval(()=>{if(!document.hidden)refresh();},3000);refresh();
