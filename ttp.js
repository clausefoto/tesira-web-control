import net from 'node:net';

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
  constructor({host, port = 23, mainMin = -24, mainMax = 12, subMin = -100, subMax = 12, timeout = 4000}) {
    this.host = host; this.port = port; this.timeout = timeout; this.tail = Promise.resolve();
    this.client = new TTP(host, port, timeout);
    this.limits = {main:{min:mainMin,max:mainMax},sub:{min:subMin,max:subMax}};
  }
  serial(fn) { const task = this.tail.then(fn); this.tail = task.catch(() => {}); return task; }
  send(text) { return this.client.send(text); }
  close() { this.client.close(); }
  async read() {
    const main = parseValue(await this.send('Level5 get levels'));
    const sub = parseValue(await this.send('Level4 get level 1'));
    if (main.length !== 6 || sub.length !== 1) throw new Error('Unexpected DSP channel count');
    return {main, sub:sub[0], limits:this.limits};
  }
  get() { return this.serial(() => this.read()); }
  set(control, value) {
    const limits = this.limits[control];
    if (!limits || typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max)
      return Promise.reject(new Error('Invalid control or level outside configured limits'));
    return this.serial(async () => {
      // Refuse writes unless both configured blocks can currently be read.
      await this.read();
      const channels = control === 'main' ? [1,2,3,4,5,6] : [1];
      try {
        for (const channel of channels) await this.send(`${control === 'main' ? 'Level5' : 'Level4'} set level ${channel} ${value}`);
        const result = await this.read();
        const actual = control === 'main' ? result.main : [result.sub];
        if (actual.some(v => Math.abs(v - value) > 0.01)) throw new Error('DSP readback differs from requested level');
        return result;
      } catch (error) { throw new Error(`Volume update incomplete; refresh actual levels before retrying. ${error.message}`); }
    });
  }
}
