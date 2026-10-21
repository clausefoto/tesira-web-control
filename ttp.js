import net from 'node:net';

// A transaction owns its connection: a late response can never satisfy a later command.
export function command(host, port, text, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host, port});
    let buffer = '', state = 'data', verb, sent = false;
    const timer = setTimeout(() => finish(new Error('DSP response timed out')), timeout);
    function finish(error, value) {
      clearTimeout(timer); socket.destroy();
      error ? reject(error) : resolve(value);
    }
    socket.on('error', error => finish(error));
    socket.on('end', () => finish(new Error('DSP closed connection')));
    socket.on('data', chunk => {
      for (const byte of chunk) {
        if (state === 'iac') {
          if ([251,252,253,254].includes(byte)) { verb = byte; state = 'option'; }
          else if (byte === 250) state = 'sub';
          else state = 'data';
        } else if (state === 'option') {
          if (verb === 253) socket.write(Buffer.from([255,252,byte]));
          if (verb === 251) socket.write(Buffer.from([255,254,byte]));
          state = 'data';
        } else if (state === 'sub') { if (byte === 255) state = 'subiac'; }
        else if (state === 'subiac') state = byte === 240 ? 'data' : 'sub';
        else if (byte === 255) state = 'iac';
        else buffer += String.fromCharCode(byte);
      }
      if (!sent && buffer.includes('Welcome to the Tesira Text Protocol Server')) {
        sent = true; buffer = ''; socket.write(text + '\r\n'); return;
      }
      if (!sent) return;
      const match = buffer.match(/(?:^|[\r\n])([+-](?:OK|ERR)[^\r\n]*)[\r\n]/);
      if (match) match[1].startsWith('-ERR') ? finish(new Error(match[1])) : finish(null, match[1]);
      if (buffer.length > 65536) finish(new Error('Oversized DSP response'));
    });
  });
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
    this.limits = {main:{min:mainMin,max:mainMax},sub:{min:subMin,max:subMax}};
  }
  serial(fn) { const task = this.tail.then(fn); this.tail = task.catch(() => {}); return task; }
  send(text) { return command(this.host, this.port, text, this.timeout); }
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
