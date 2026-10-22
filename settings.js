import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';

export const defaultControls = {
  main: {tag:'Level5', channels:6, gang:true},
  sub: {tag:'Level4', channels:1, gang:true}
};

export function validateControls(input) {
  const result={};
  for(const key of ['main','sub']) {
    const c=input?.[key];
    if(!c || typeof c.tag!=='string' || !/^[A-Za-z0-9_. -]{1,64}$/.test(c.tag) || !c.tag.trim())
      throw new Error(`${key}: enter a valid instance tag (letters, numbers, spaces, dots, underscores or hyphens; maximum 64 characters)`);
    if(!Number.isInteger(c.channels) || c.channels<1 || c.channels>32)
      throw new Error(`${key}: channel count must be between 1 and 32`);
    if(typeof c.gang!=='boolean')throw new Error(`${key}: Gang must be on or off`);
    result[key]={tag:c.tag,channels:c.channels,gang:c.gang};
  }
  return result;
}
export async function loadControls(path) {
  try{return validateControls(JSON.parse(await readFile(path,'utf8')));}
  catch(e){if(e.code==='ENOENT')return validateControls(defaultControls);throw e;}
}
export async function saveControls(path,controls) {
  const validated=validateControls(controls);
  await mkdir(dirname(path),{recursive:true});
  const temporary=path+'.tmp';
  await writeFile(temporary,JSON.stringify(validated,null,2)+'\n',{mode:0o600});
  await rename(temporary,path);
  return validated;
}
export function instanceTag(tag) {return tag.includes(' ')?JSON.stringify(tag):tag;}
