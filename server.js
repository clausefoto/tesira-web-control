import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {DSP} from './ttp.js';
import {loadControls, saveControls, validateControls, controlsFromEnvironment} from './settings.js';

const numeric=(key,fallback)=>{
  const n=Number(process.env[key]??fallback);
  if(!Number.isFinite(n))throw new Error(`Invalid ${key}`);
  return n;
};
const settingsFile=process.env.SETTINGS_FILE || './data/settings.json';
const dsp=new DSP({host:process.env.DSP_HOST || '192.0.2.10',port:numeric('DSP_PORT',23),
  mainMin:numeric('MAIN_MIN_DB',-24),mainMax:numeric('MAIN_MAX_DB',12),
  subMin:numeric('SUB_MIN_DB',-100),subMax:numeric('SUB_MAX_DB',12),
  controls:await loadControls(settingsFile,()=>controlsFromEnvironment())});
for(const limit of Object.values(dsp.limits))if(limit.min>=limit.max)throw new Error('Minimum must be below maximum');
const assets={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css']};
let pending=0;
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if(req.method==='GET' && assets[req.url]){
      const [file,type]=assets[req.url];res.writeHead(200,{'Content-Type':type});res.end(await readFile(new URL(file,import.meta.url)));return;
    }
    if(req.url==='/health' && req.method==='GET')return json(200,{status:'running'});
    if(req.url==='/api/settings' && req.method==='GET')return json(200,{controls:dsp.controls,settingsKey:dsp.settingsKey});
    if(!['/api/state','/api/volume','/api/settings'].includes(req.url))return json(404,{error:'Not found'});
    if(pending>=3)return json(429,{error:'DSP busy; try again shortly'});
    if(req.url==='/api/state' && req.method==='GET'){
      pending++;try{return json(200,await dsp.get());}finally{pending--;}
    }
    if(req.method==='POST' && ['/api/volume','/api/settings'].includes(req.url)){
      if(req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)))return json(403,{error:'Origin rejected'});
      if(req.headers['content-type']!=='application/json')return json(415,{error:'JSON required'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return json(413,{error:'Request too large'});}
      let data;try{data=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON'});}
      if(req.url==='/api/settings'){
        let controls;try{controls=validateControls(data?.controls);}catch(error){return json(400,{error:error.message});}
        pending++;try{return json(200,await dsp.configure(controls,c=>saveControls(settingsFile,c)));}finally{pending--;}
      }
      try{
        if(typeof data?.settingsKey!=='string')throw new Error('Refresh the dashboard before adjusting volume');
        dsp.validateWrite(data.control,data.value,data.channel,data.settingsKey);
      }catch(error){return json(400,{error:error.message});}
      pending++;try{return json(200,await dsp.set(data.control,data.value,data.channel,data.settingsKey));}finally{pending--;}
    }
    return json(405,{error:'Method not allowed'});
  }catch(error){json(503,{error:error.message});}
});
server.requestTimeout=10000;
server.listen(numeric('PORT',8088),'0.0.0.0',()=>console.log(`Tesira dashboard listening on ${server.address().port}`));
