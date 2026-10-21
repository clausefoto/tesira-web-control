import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {DSP, command, parseValue} from '../ttp.js';

async function simulator(t) {
  const main=Array(6).fill(-6);let sub=12,fail=false,connections=0;const writes=[];const sockets=new Set();
  const server=net.createServer(socket=>{
    connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
    socket.write(Buffer.from([255,253]));
    setTimeout(()=>{if(!socket.destroyed){socket.write(Buffer.from([24]));socket.write('Welcome to the Tesira Text Protocol Server...\r\n');}},5);
    let text='';socket.on('data',data=>{
      // Remove Telnet refusal replies before reading application text.
      text+=data.toString('latin1').replace(/\xff[\xfc\xfe]./g,'');
      while(text.includes('\n')){
        const i=text.indexOf('\n'),line=text.slice(0,i).trim();text=text.slice(i+1);
        let reply;
        if(line==='Level5 get levels')reply=`+OK "value":[${main.join(' ')}]`;
        else if(line==='Level4 get level 1')reply=`+OK "value":${sub}`;
        else {
          const match=line.match(/^(Level[45]) set level (\d) ([-\d.]+)$/);
          if(!match){socket.write('-ERR unknown\r\n');continue;}
          writes.push(line);
          if(fail && match[2]==='3'){socket.write('-ERR simulated failure\r\n');continue;}
          if(match[1]==='Level5')main[Number(match[2])-1]=Number(match[3]);else sub=Number(match[3]);reply='+OK';
        }
        socket.write(reply.slice(0,2));setTimeout(()=>{if(!socket.destroyed)socket.write(reply.slice(2)+'\r\n');},2);
      }
    });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>{for(const s of sockets)s.destroy();server.close();});
  const dsp=new DSP({host:'127.0.0.1',port:server.address().port,timeout:500});
  return {dsp,writes,main,get sub(){return sub;},set fail(v){fail=v;},get connections(){return connections;}};
}
test('parses levels and rejects absent/non-finite data',()=>{
 assert.deepEqual(parseValue('+OK "value":[-6.000000 12.000000]'),[-6,12]);
 assert.throws(()=>parseValue('+OK'));assert.throws(()=>parseValue('+OK "value":[NaN]'));
});
test('reads without startup writes; fragmented negotiation and responses',async t=>{
 const s=await simulator(t);assert.deepEqual((await s.dsp.get()).main,Array(6).fill(-6));assert.equal(s.writes.length,0);
});
test('main writes all six and preserves sub; sub leaves main unchanged',async t=>{
 const s=await simulator(t);await s.dsp.set('main',-8);assert.deepEqual(s.main,Array(6).fill(-8));assert.equal(s.sub,12);assert.equal(s.writes.length,6);
 await s.dsp.set('sub',3);assert.equal(s.sub,3);assert.deepEqual(s.main,Array(6).fill(-8));
});
test('invalid input cannot connect or write',async t=>{
 const s=await simulator(t);for(const [key,value]of [['main',13],['main',NaN],['sub',-101],['main','0'],['unknown',0]])await assert.rejects(s.dsp.set(key,value));assert.equal(s.connections,0);
});
test('partial main failure stops further writes and allows fresh reads',async t=>{
 const s=await simulator(t);s.fail=true;await assert.rejects(s.dsp.set('main',-10),/incomplete/);assert.equal(s.writes.length,3);
 assert.deepEqual((await s.dsp.get()).main,[-10,-10,-6,-6,-6,-6]);
});
test('serializes concurrent requests',async t=>{
 const s=await simulator(t);await Promise.all([s.dsp.set('main',-12),s.dsp.set('sub',0),s.dsp.get()]);assert.deepEqual(s.main,Array(6).fill(-12));assert.equal(s.sub,0);
});
test('a silent DSP times out',async t=>{
 const sockets=new Set(),server=net.createServer(s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{for(const s of sockets)s.destroy();server.close();});
 await assert.rejects(command('127.0.0.1',server.address().port,'Level5 get levels',40),/timed out/);
});
