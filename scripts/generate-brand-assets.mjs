// Render our editable SVG sources, never remote images or visitor data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const icon=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
const card=await readFile(new URL('../brand/social-card.svg',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
  const render=async(svg,width,height)=>{
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    try{
      await page.setContent('<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>'+svg);
      return await page.screenshot({omitBackground:true});
    }finally{await page.close();}
  };
  await mkdir(new URL('../public/icons/',import.meta.url),{recursive:true});
  for(const size of [48,180,192,512])await writeFile(new URL(`../public/icons/icon-${size}.png`,import.meta.url),await render(icon,size,size));
  await writeFile(new URL('../public/icons/maskable-512.png',import.meta.url),await render(icon.replace('rx="14"','rx="0"'),512,512));
  const sizes=[16,32,48],images=await Promise.all(sizes.map(size=>render(icon,size,size)));
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  for(let i=0;i<sizes.length;i++){
    const at=6+i*16;header[at]=sizes[i];header[at+1]=sizes[i];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(images[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=images[i].length;
  }
  await writeFile(new URL('../public/favicon.ico',import.meta.url),Buffer.concat([header,...images]));
  await writeFile(new URL('../public/social-card.png',import.meta.url),await render(card,1200,630));
  console.log('Local SVG brand assets rendered: favicon, app/touch/maskable icons and 1200×630 social card.');
}finally{await browser.close();}
