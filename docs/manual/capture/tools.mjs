// 주석(빨간 표시)·확대 크롭·영상 변환/합성 도구
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const req=createRequire('C:/Users/ACE/Desktop/bobs_project/ai-3d-coedit/.worktrees/implementation/package.json');
const sharp=req('sharp');
export const MEDIA=path.resolve('C:/Users/ACE/Desktop/bobs_project/ai-3d-coedit/.worktrees/implementation/docs/manual/media');
fs.mkdirSync(MEDIA,{recursive:true});
const RED='#e5262b';
export const DPR=2; // 스샷은 2배 해상도, 박스는 CSS px
const sc=b=>b&&({x:b.x*DPR,y:b.y*DPR,width:b.width*DPR,height:b.height*DPR});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

// marks: [{box:{x,y,width,height}, n?:number, label?:string}]  (box = page/screenshot 좌표)
function overlay(w,h,marks,pad0=6,k=DPR){
 const pad=pad0*k;
 const parts=marks.filter(m=>m.box).map(m=>{
  const x=Math.max(2,m.box.x-pad),y=Math.max(2,m.box.y-pad),bw=Math.min(w-x-2,m.box.width+pad*2),bh=Math.min(h-y-2,m.box.height+pad*2);
  let s=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${8*k}" fill="none" stroke="${RED}" stroke-width="${4*k}"/>`;
  const R=16*k;if(m.n!=null){const cx=x-R*0.9>R?x-R*0.9:x+R,cy=y-R*0.9>R?y-R*0.9:y+R;s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${RED}" stroke="#fff" stroke-width="${2*k}"/><text x="${cx}" y="${cy+6*k}" font-family="Malgun Gothic,sans-serif" font-size="${18*k}" font-weight="700" fill="#fff" text-anchor="middle">${m.n}</text>`;}
  if(m.label){const tw=(m.label.length*16+22)*k,th=31*k,gap=12*k;let lx,ly;const side=m.side||'auto';
   const fitsR=x+bw+gap+tw<w-4,fitsL=x-gap-tw>4;
   if((side==='auto'||side==='right')&&fitsR){lx=x+bw+gap;ly=y+bh/2+th/2-8*k;}
   else if((side==='auto'||side==='left')&&fitsL){lx=x-gap-tw;ly=y+bh/2+th/2-8*k;}
   else if(side!=='above'&&y+bh+th+gap<h){lx=Math.max(4,Math.min(x,w-tw-4));ly=y+bh+gap+th-8*k;}
   else {lx=Math.max(4,Math.min(x+R*1.4,w-tw-4));ly=y-gap;}
   s+=`<rect x="${lx}" y="${ly-23*k}" width="${tw}" height="${th}" rx="${6*k}" fill="${RED}"/><text x="${lx+11*k}" y="${ly-1*k}" font-family="Malgun Gothic,sans-serif" font-size="${16*k}" font-weight="700" fill="#fff">${esc(m.label)}</text>`;}
  return s;}).join('');
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${parts}</svg>`);
}
export async function annotate(src,outName,marks,{pad=6}={}){
 const img=sharp(src),{width,height}=await img.metadata();
 const out=path.join(MEDIA,outName+'.png');
 const buf=await img.composite([{input:overlay(width,height,marks.map(m=>({...m,box:sc(m.box)})),pad)}]).png().toBuffer();
 await sharp(buf).resize(Math.min(width,1600)).png({compressionLevel:9}).toFile(out);
 console.log('annotated',outName);return out;
}
// 확대 크롭: box 주변 margin 포함, scale배 확대, 내부 표시 유지
export async function zoom(src,outName,box,{margin=40,scale=1,marks=[]}={}){
 const {width,height}=await sharp(src).metadata();box=sc(box);margin*=DPR;marks=marks.map(m=>({...m,box:sc(m.box)}));
 const left=Math.max(0,Math.round(box.x-margin)),top=Math.max(0,Math.round(box.y-margin));
 const w=Math.min(width-left,Math.round(box.width+margin*2)),h=Math.min(height-top,Math.round(box.height+margin*2));
 const local=marks.map(m=>({...m,box:m.box&&{x:m.box.x-left,y:m.box.y-top,width:m.box.width,height:m.box.height}}));
 const base=await sharp(src).extract({left,top,width:w,height:h}).png().toBuffer();
 const marked=local.length?await sharp(base).composite([{input:overlay(w,h,local,4)}]).png().toBuffer():base;
 const out=path.join(MEDIA,outName+'.png');
 await sharp(marked).resize(Math.round(w*scale),Math.round(h*scale),{kernel:'lanczos3'}).png({compressionLevel:9}).toFile(out);
 console.log('zoomed',outName);return out;
}
export const union=(...bs)=>{bs=bs.filter(Boolean);const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));return {x,y,width:Math.max(...bs.map(b=>b.x+b.width))-x,height:Math.max(...bs.map(b=>b.y+b.height))-y};};

const FF='C:/ffmpeg/bin/ffmpeg.exe',FONT='C\\:/Windows/Fonts/malgunbd.ttf';
// webm → mp4(H.264), 구간 자르기, 폭 축소
export function toMp4(webm,outName,{start=0,dur,width=1280,crf=28}={}){
 const out=path.join(MEDIA,outName+'.mp4');
 execFileSync(FF,['-y','-loglevel','error','-ss',String(start),...(dur?['-t',String(dur)]:[]),'-i',webm,'-vf',`scale=${width}:-2,fps=24`,'-c:v','libx264','-preset','slow','-crf',String(crf),'-pix_fmt','yuv420p','-movflags','+faststart','-an',out]);
 console.log('video',outName,(fs.statSync(out).size/1e6).toFixed(2)+'MB');return out;
}
// 좌우 합성: a,b 각각 시작 오프셋으로 시간 맞춤, 라벨 표기
export function sideBySide(a,b,outName,{offA=0,offB=0,dur,labels=['학생 1','학생 2'],each=800,crf=28}={}){
 const out=path.join(MEDIA,outName+'.mp4');
 const lab=(i,t)=>`drawbox=x=0:y=0:w=iw:h=44:color=black@0.55:t=fill,drawtext=fontfile='${FONT}':text='${t}':x=16:y=10:fontsize=24:fontcolor=white`;
 const fc=`[0:v]scale=${each}:-2,fps=24,${lab(0,labels[0])}[l];[1:v]scale=${each}:-2,fps=24,${lab(1,labels[1])}[r];[l][r]hstack=inputs=2,drawbox=x=${each-2}:y=0:w=4:h=ih:color=white@1:t=fill[v]`;
 execFileSync(FF,['-y','-loglevel','error','-ss',String(offA),...(dur?['-t',String(dur)]:[]),'-i',a,'-ss',String(offB),...(dur?['-t',String(dur)]:[]),'-i',b,'-filter_complex',fc,'-map','[v]','-c:v','libx264','-preset','slow','-crf',String(crf),'-pix_fmt','yuv420p','-movflags','+faststart','-an',out]);
 console.log('video',outName,(fs.statSync(out).size/1e6).toFixed(2)+'MB');return out;
}
// 두 스샷 좌우 합성(라벨 포함)
export async function pair(a,b,outName,labels=['학생 1','학생 2']){
 const W=1600,ims=await Promise.all([a,b].map(f=>sharp(f).resize(W).png().toBuffer()));const {height:H}=await sharp(ims[0]).metadata();
 const lab=t=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="72"><rect width="${W}" height="72" fill="#1d2a24"/><text x="28" y="49" font-family="Malgun Gothic" font-size="36" font-weight="700" fill="#fff">${t}</text></svg>`);
 const out=path.join(MEDIA,outName+'.png');
 await sharp({create:{width:W*2+16,height:H+72,channels:3,background:'#ffffff'}}).composite([{input:lab(labels[0]),left:0,top:0},{input:lab(labels[1]),left:W+16,top:0},{input:ims[0],left:0,top:72},{input:ims[1],left:W+16,top:72}]).png().toBuffer().then(buf=>sharp(buf).resize(2400).png({compressionLevel:9}).toFile(out));
 console.log('pair',outName);return out;
}
