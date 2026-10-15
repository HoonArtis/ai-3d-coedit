// guide.html 점검: 깨진 링크, 넘침, 너무 작게 축소된 화면, 영상 상태, 대비, 확대 보기, 로딩 시간
import {chromium,OUT,sleep} from './lib.mjs';
import path from 'node:path';
const file='file:///'+path.resolve('../guide.html').split(path.sep).join('/');
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const report={};
for(const [name,w,scheme] of [['1440',1440,'light'],['1100',1100,'dark'],['768',768,'light'],['400',400,'light'],['360',360,'dark']]){
 const c=await b.newContext({viewport:{width:w,height:860},colorScheme:scheme});const p=await c.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 const t0=Date.now();await p.goto(file,{waitUntil:'load'});const loadMs=Date.now()-t0;await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});await sleep(1500);
 const r=await p.evaluate(()=>{
  const out={};
  out.page={sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};
  out.badLinks=[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(id=>id&&!document.getElementById(id));
  // 내부 넘침
  out.overflow=[...document.querySelectorAll('main *')].filter(e=>{const s=getComputedStyle(e);return e.scrollWidth>e.clientWidth+2&&s.overflowX!=='auto'&&s.overflowX!=='scroll'&&e.clientWidth>0&&!['VIDEO','IMG','svg'].includes(e.tagName)}).slice(0,15).map(e=>(e.closest('[id]')?.id||'')+' '+e.tagName+'.'+e.className+' '+e.scrollWidth+'>'+e.clientWidth);
  // 축소 비율: 화면 촬영 이미지가 원본 대비 얼마나 작게 보이는지(원본 1600 기준 표시폭)
  out.tiny=[...document.querySelectorAll('.card figure.shot img')].map(i=>({id:i.closest('.card').id,f:i.alt,w:Math.round(i.getBoundingClientRect().width),k:i.getBoundingClientRect().width/i.naturalWidth})).filter(x=>x.w>0&&x.w<330).map(x=>x.id+' '+x.w+'px');
  out.zoomTiny=[...document.querySelectorAll('.card figure.zoom img')].map(i=>({id:i.closest('.card').id,h:Math.round(i.getBoundingClientRect().height),w:Math.round(i.getBoundingClientRect().width)})).filter(x=>x.h>0&&x.h<40).map(x=>x.id+' '+x.w+'x'+x.h);
  // 글자 크기 12px 미만
  out.smallText=[...new Set([...document.querySelectorAll('main *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<12).map(e=>e.className||e.tagName))];
  // 대비
  const rgb=s=>s.match(/[\d.]+/g).map(Number);const L=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]};
  const bgOf=e=>{while(e){const c=getComputedStyle(e).backgroundColor;const v=rgb(c);if(v.length<4||v[3]>0.5)return v;e=e.parentElement}return [255,255,255]};
  const low=new Map();for(const e of document.querySelectorAll('main *')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const fg=rgb(getComputedStyle(e).color),bg=bgOf(e);const l1=L(fg),l2=L(bg);const cr=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);if(cr<4.5){const k=(e.className||e.tagName)+'';low.set(k,Math.min(low.get(k)||99,+cr.toFixed(2)))}}
  out.lowContrast=[...low].map(([k,v])=>k+' '+v);
  // 비어 있는 카드 미디어
  out.emptyMedia=[...document.querySelectorAll('.card .media:empty')].map(m=>m.closest('.card').id+':'+m.closest('.card').dataset.st);
  out.videos=document.querySelectorAll('video').length;out.autoplay=document.querySelectorAll('video[autoplay]').length;
  out.cardsNoText=[...document.querySelectorAll('.card')].filter(c=>c.querySelectorAll('li').length===0).map(c=>c.id);
  return out;});
 // 영상: 각 영상으로 스크롤하여 재생 여부
 r.videoState=[];for(const i of [...Array(r.videos).keys()]){const st=await p.evaluate(async i=>{const v=document.querySelectorAll('video')[i];v.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,900));return {id:v.closest('.card')?.id,ready:v.readyState,paused:v.paused,t:+v.currentTime.toFixed(2),dur:+v.duration.toFixed(1),w:Math.round(v.getBoundingClientRect().width)}},i);r.videoState.push(st)}
 r.videoBad=r.videoState.filter(v=>v.ready<3||v.paused||v.t===0);
 // 확대 보기
 await p.evaluate(()=>window.scrollTo(0,0));const z=p.locator('.zoomable').first();await z.scrollIntoViewIfNeeded();await z.click();await sleep(400);
 r.lightboxOpen=await p.evaluate(()=>document.getElementById('lb').open);await p.keyboard.press('Escape');await sleep(200);r.lightboxClosed=!(await p.evaluate(()=>document.getElementById('lb').open));
 // 흐름 링크 클릭 후 목적 카드가 화면에 보이는지
 await p.evaluate(()=>window.scrollTo(0,0));await p.locator('.mainflow a.go').nth(4).click();await sleep(1200);
 r.flowJump=await p.evaluate(()=>{const e=document.getElementById('M2-03').getBoundingClientRect();return {top:Math.round(e.top),visible:e.top>=-5&&e.top<innerHeight}});
 r.loadMs=loadMs;r.errors=errs;delete r.videoState;report[name]=r;await c.close();
}
console.log(JSON.stringify(report,null,1));await b.close();
