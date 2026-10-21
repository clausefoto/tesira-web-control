const controls = document.querySelector('#controls');
let current, busy = false, editing = false, online = false;
for (const [key,title] of [['main','Main volume'],['sub','Subwoofer']]) {
  const card=document.createElement('section');card.className='card';
  card.innerHTML=`<div class="row"><h2>${title}</h2><div><output class="value" id="${key}-value">—</output> <span class="unit">dB</span></div></div><p class="hint" id="${key}-hint"></p><input type="range" id="${key}" step="0.5" aria-label="${title}" disabled><div class="range-labels"><span id="${key}-min"></span><span id="${key}-max"></span></div><div class="adjust"><button data-key="${key}" data-delta="-0.5" aria-label="Decrease ${title}" disabled>−</button><button data-key="${key}" data-delta="0.5" aria-label="Increase ${title}" disabled>+</button></div>`;
  controls.append(card);
  const slider=document.getElementById(key);
  slider.oninput=()=>{editing=true;document.getElementById(`${key}-value`).textContent=Number(slider.value).toFixed(1);};
  slider.onchange=()=>{editing=false;write(key,Number(slider.value));};
  slider.onpointercancel=()=>{editing=false;refresh();};
}
function enable() {document.querySelectorAll('#controls button, #controls input').forEach(el=>el.disabled=busy || !online);}
function render(data) {
  current=data;
  for(const key of ['main','sub']) {
    const values=key==='main'?data.main:[data.sub],value=values[0],limits=data.limits[key];
    const slider=document.getElementById(key);slider.min=limits.min;slider.max=limits.max;slider.value=value;
    document.getElementById(`${key}-value`).textContent=value.toFixed(1);
    document.getElementById(`${key}-min`).textContent=`${limits.min} dB`;
    document.getElementById(`${key}-max`).textContent=`+${limits.max} dB`;
    document.getElementById(`${key}-hint`).textContent=key==='main' && values.some(v=>Math.abs(v-value)>.01)?`Channels differ: ${values.join(', ')} dB. Adjusting will set all six equally.`:key==='main'?'All six channels together':'Independent subwoofer level';
  }
}
async function request(path,options) {const res=await fetch(path,options);const data=await res.json();if(!res.ok)throw new Error(data.error || 'Connection failed');return data;}
async function run(action) {
  if(busy)return;busy=true;enable();document.getElementById('error').textContent='';
  try {render(await action());online=true;document.getElementById('status').textContent='● Connected · Levels synchronized';}
  catch(e){online=false;document.getElementById('status').textContent='Disconnected · Controls paused';document.getElementById('error').textContent=e.message;}
  finally{busy=false;enable();}
}
function refresh(){if(!editing)run(()=>request('/api/state'));}
function write(control,value){run(()=>request('/api/volume',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({control,value})}));}
document.querySelectorAll('[data-delta]').forEach(button=>button.onclick=()=>{
  if(!current)return;const key=button.dataset.key,limit=current.limits[key],value=(key==='main'?current.main[0]:current.sub)+Number(button.dataset.delta);
  write(key,Math.max(limit.min,Math.min(limit.max,value)));
});
document.getElementById('retry').onclick=()=>{editing=false;refresh();};
setInterval(()=>{if(!document.hidden)refresh();},3000);refresh();
