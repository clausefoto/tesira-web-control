import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {DSP} from './ttp.js';

const numeric = (key, fallback) => {
  const n = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${key}`);
  return n;
};
const dsp = new DSP({host:process.env.DSP_HOST || '192.0.2.10', port:numeric('DSP_PORT',23),
  mainMin:numeric('MAIN_MIN_DB',-24),mainMax:numeric('MAIN_MAX_DB',12),
  subMin:numeric('SUB_MIN_DB',-100),subMax:numeric('SUB_MAX_DB',12)});
for (const limit of Object.values(dsp.limits)) if (limit.min >= limit.max) throw new Error('Minimum must be below maximum');
const assets = {'/':['public/index.html','text/html'], '/app.js':['public/app.js','text/javascript'], '/style.css':['public/style.css','text/css']};
let pending = 0;
const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const json = (status, data) => {res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if (req.method === 'GET' && assets[req.url]) {
      const [file,type] = assets[req.url];res.writeHead(200,{'Content-Type':type});res.end(await readFile(new URL(file,import.meta.url)));return;
    }
    if (req.url === '/health' && req.method === 'GET') return json(200,{status:'running'});
    if (!['/api/state','/api/volume'].includes(req.url)) return json(404,{error:'Not found'});
    if (pending >= 3) return json(429,{error:'DSP busy; try again shortly'});
    if (req.url === '/api/state' && req.method === 'GET') {
      pending++; try {return json(200,await dsp.get());} finally {pending--;}
    }
    if (req.url === '/api/volume' && req.method === 'POST') {
      // Block cross-origin form submissions; only the local dashboard sends JSON.
      if (req.headers['sec-fetch-site'] === 'cross-site' ||
          (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`)) return json(403,{error:'Origin rejected'});
      if (req.headers['content-type'] !== 'application/json') return json(415,{error:'JSON required'});
      let body = '';for await (const chunk of req) {body += chunk;if(body.length > 1024) return json(413,{error:'Request too large'});}
      let data;try {data=JSON.parse(body);} catch {return json(400,{error:'Invalid JSON'});}
      const limit = dsp.limits[data.control];
      if (!limit || typeof data.value !== 'number' || !Number.isFinite(data.value) || data.value < limit.min || data.value > limit.max) return json(400,{error:'Invalid control or level'});
      pending++;try {return json(200,await dsp.set(data.control,data.value));} finally {pending--;}
    }
    return json(405,{error:'Method not allowed'});
  } catch(error) {json(503,{error:error.message});}
});
server.requestTimeout = 10000;
server.listen(numeric('PORT',8088),'0.0.0.0',()=>console.log('Tesira dashboard listening'));
