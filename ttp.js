import net from 'node:net';
import {defaultControls, validateControls, instanceTag} from './settings.js';

// One in-flight command per session. Any transport ambiguity destroys the session.
export class TTP {
  constructor(host, port, timeout = 4000) {
    this.host=host;this.port=port;this.timeout=timeout;
    this.socket=null;this.pending=null;this.connecting=null;
  }
  close(error = new Error('DSP disconnected')) {
    const socket=this.socket;this.socket=null;this.ready=false;
    this.rejectConnect?.(error);this.rejectConnect=null;
    if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);p.reject(error);}
    socket?.destroy();
  }
  async connect() {
    if(this.ready && this.socket && !this.socket.destroyed)return;
    if(this.connecting)return this.connecting;
    this.connecting=new Promise((resolve,reject)=>{
      const socket=net.createConnection({host:this.host,port:this.port});this.socket=socket;
      socket.setNoDelay(true);
      let buffer='',state='data',verb;
      const timer=setTimeout(()=>this.close(new Error('DSP connection timed out')),this.timeout);
      this.rejectConnect=error=>{clearTimeout(timer);reject(error);};
      socket.on('error',error=>{if(this.socket===socket)this.close(error);});
      socket.on('close',()=>{if(this.socket===socket)this.close(new Error('DSP closed connection'));});
      socket.on('data',chunk=>{
        if(this.socket!==socket)return;
        for(const byte of chunk){
          if(state==='iac'){
            if([251,252,253,254].includes(byte)){verb=byte;state='option';}
            else if(byte===250)state='sub';else state='data';
          }else if(state==='option'){
            if(verb===253)socket.write(Buffer.from([255,252,byte]));
            if(verb===251)socket.write(Buffer.from([255,254,byte]));
            state='data';
          }else if(state==='sub'){if(byte===255)state='subiac';}
          else if(state==='subiac')state=byte===240?'data':'sub';
          else if(byte===255)state='iac';else buffer+=String.fromCharCode(byte);
        }
        if(!this.ready && buffer.includes('Welcome to the Tesira Text Protocol Server')){
          this.ready=true;clearTimeout(timer);this.rejectConnect=null;buffer='';resolve();
        }
        let match;
        while((match=buffer.match(/^[^\r\n]*[\r\n]+/))){
          const line=match[0].trim();buffer=buffer.slice(match[0].length);
          if(!/^[+-](OK|ERR)(?:\s|$)/.test(line))continue;
          const p=this.pending;
          if(!p){this.close(new Error('Unexpected DSP response'));return;}
          this.pending=null;clearTimeout(p.timer);
          if(line.startsWith('-ERR'))p.reject(new Error(line));else p.resolve(line);
        }
        if(buffer.length>65536)this.close(new Error('Oversized DSP response'));
      });
    });
    try{await this.connecting;}finally{this.connecting=null;}
  }
  async send(text){
    await this.connect();
    if(this.pending)throw new Error('Concurrent TTP command');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.close(new Error('DSP response timed out')),this.timeout);
      this.pending={resolve,reject,timer};
      this.socket.write(text+'\r\n');
    });
  }
}

export async function command(host,port,text,timeout=4000){
  const client=new TTP(host,port,timeout);
  try{return await client.send(text);}finally{client.close();}
}

export function parseValue(response) {
  const value = response.match(/"value"\s*:\s*(\[[^\]]*\]|[-+\d.eE]+)/)?.[1];
  if (!value) throw new Error('Missing DSP level value');
  const values = value.replace(/[\[\]]/g, '').trim().split(/\s+/).map(Number);
  if (!values.length || !values.every(Number.isFinite)) throw new Error('Invalid DSP level value');
  return values;
}

export class DSP {
  constructor({host, port = 23, mainMin = -24, mainMax = 12, subMin = -100, subMax = 12, timeout = 4000, controls = defaultControls}) {
    this.host = host; this.port = port; this.timeout = timeout; this.tail = Promise.resolve();
    this.client = new TTP(host, port, timeout);
    this.controls = validateControls(controls);
    this.limits = {main:{min:mainMin,max:mainMax},sub:{min:subMin,max:subMax}};
  }
  serial(fn) { const task = this.tail.then(fn); this.tail = task.catch(() => {}); return task; }
  send(text) { return this.client.send(text); }
  close() { this.client.close(); }
  get settingsKey() { return JSON.stringify(this.controls); }
  async read() {
    const levels={};
    for(const key of ['main','sub']) {
      const config=this.controls[key],tag=instanceTag(config.tag);
      const values=parseValue(await this.send(`${tag} get ${config.channels===1?'level 1':'levels'}`));
      if(values.length<config.channels)throw new Error(`${key}: requested ${config.channels} channels but DSP returned ${values.length}`);
      levels[key]=values.slice(0,config.channels);
    }
    return {main:levels.main,sub:levels.sub[0],levels,limits:this.limits,controls:this.controls,settingsKey:this.settingsKey};
  }
  get() { return this.serial(() => this.read()); }
  configure(controls,persist) {
    const validated=validateControls(controls);
    return this.serial(async()=>{
      await persist(validated);
      this.controls=validated;
      this.client.close();
      return {controls:this.controls,settingsKey:this.settingsKey};
    });
  }
  validateWrite(control,value,channel,settingsKey) {
    const limit=Object.hasOwn(this.limits,control)?this.limits[control]:null;
    if(!limit || typeof value!=='number' || !Number.isFinite(value) || value<limit.min || value>limit.max)
      throw new Error('Invalid control or level outside configured limits');
    if(settingsKey!==undefined && settingsKey!==this.settingsKey)throw new Error('Settings changed; refresh controls before adjusting volume');
    const config=this.controls[control];
    if(!config.gang && (!Number.isInteger(channel) || channel<1 || channel>config.channels))
      throw new Error('Select a valid individual channel');
    if(config.gang && channel!==undefined)throw new Error('Individual channel writes are disabled while Gang is on');
  }
  set(control,value,channel,settingsKey) {
    try{this.validateWrite(control,value,channel,settingsKey);}catch(error){return Promise.reject(error);}
    return this.serial(async()=>{
      this.validateWrite(control,value,channel,settingsKey);
      // Check the configured blocks before any write, including after reconnects.
      await this.read();
      const config=this.controls[control],tag=instanceTag(config.tag);
      const channels=config.gang?Array.from({length:config.channels},(_,i)=>i+1):[channel];
      try {
        for(const index of channels)await this.send(`${tag} set level ${index} ${value}`);
        const result=await this.read();
        if(channels.some(index=>Math.abs(result.levels[control][index-1]-value)>0.01))
          throw new Error('DSP readback differs from requested level');
        return result;
      }catch(error){throw new Error(`Volume update incomplete; refresh actual levels before retrying. ${error.message}`);}
    });
  }
}
