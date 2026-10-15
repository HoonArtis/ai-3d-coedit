import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req=createRequire('C:/Users/ACE/Desktop/bobs_project/ai-3d-coedit/.worktrees/implementation/package.json');
export const {chromium}=req('@playwright/test');
export const WEB='http://127.0.0.1:4173',API='http://127.0.0.1:2567/api';
export const OUT=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')),'out');
fs.mkdirSync(OUT,{recursive:true});
export const STATE=path.join(OUT,'state.json');
export const loadState=()=>fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,'utf8')):{};
export const saveState=s=>fs.writeFileSync(STATE,JSON.stringify(s,null,1));
export const api=async(p,{token,body,method}={})=>{const r=await fetch(API+p,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const t=await r.text();try{return JSON.parse(t)}catch{return t}};
export const VIEW={width:1600,height:900};export const CTX={viewport:VIEW,deviceScaleFactor:2};
export const shot=async(page,name,opts={})=>{const p=path.join(OUT,name+'.png');await page.evaluate(()=>{const c=document.getElementById('__cur');if(c)c.style.visibility='hidden';}).catch(()=>{});await page.screenshot({path:p,...opts});await page.evaluate(()=>{const c=document.getElementById('__cur');if(c)c.style.visibility='';}).catch(()=>{});console.log('shot',name);return p;};
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Return boxes (page coords) of locators for annotation
export const boxes=async(page,list)=>{const o={};for(const [k,loc] of Object.entries(list)){try{o[k]=await loc.first().boundingBox({timeout:3000});}catch{o[k]=null}}return o;};
// 세션 열기: 학생 n(저장된 자리), 강사(토큰). record=true면 녹화
export async function openStudent(browser,n,{record=false,url=WEB+'/'}={}){
 const ctx=await browser.newContext({...CTX,storageState:path.join(OUT,`student${n}_storage.json`),...(record?{recordVideo:{dir:path.join(OUT,'rec'),size:VIEW}}:{})});
 if(record)await ctx.addInitScript(CURSOR);
 const page=await ctx.newPage();const t0=Date.now();
 await page.goto(url);await page.getByText('서버 연결됨',{exact:true}).waitFor({timeout:30000});await sleep(1500);
 return {ctx,page,t0};
}
export async function openTeacher(browser,{record=false,url=WEB+'/?teacher=1'}={}){
 const st=loadState();
 const ctx=await browser.newContext({...CTX,...(record?{recordVideo:{dir:path.join(OUT,'rec'),size:VIEW}}:{})});
 await ctx.addInitScript(t=>localStorage.setItem('coedit-account-token',t),st.teacher.token);
 if(record)await ctx.addInitScript(CURSOR);
 const page=await ctx.newPage();const t0=Date.now();await page.goto(url);await sleep(1500);
 return {ctx,page,t0};
}
export const launch=()=>chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
export async function finishVideo(s){const v=s.page.video();await s.ctx.close();return v?await v.path():null;}
// 장면 비우기: 내 에셋 전부 삭제(장면 개체 버튼 사용 대신 AI 명령 없이 UI로) — 에셋 수 0 될 때까지 선택+삭제
export async function closeNotice(page){for(let i=0;i<3;i++){const c=page.getByRole('button',{name:'안내 닫기'});if(await c.count()&&await c.first().isVisible()){await c.first().click();await sleep(200);}else return;}}
export async function clearMine(page){
 for(let i=0;i<60;i++){const t=await page.getByLabel('에셋 수').textContent();if(t.startsWith('0 '))return;
  await page.keyboard.press('Escape');const items=page.locator('[aria-label$=" 선택"]');if(!(await items.count()))return;
  await items.first().click();await sleep(150);const del=page.getByRole('button',{name:'삭제',exact:true});if(await del.count()&&await del.isEnabled())await del.click();else break;await sleep(250);}
 await page.keyboard.press('Escape');await closeNotice(page);
}

// 녹화용 가짜 커서(헤드리스 영상에 마우스가 안 보이므로)
export const CURSOR=`(()=>{addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');c.id='__cur';Object.assign(c.style,{position:'fixed',left:'-60px',top:'-60px',width:'22px',height:'22px',marginLeft:'-11px',marginTop:'-11px',borderRadius:'50%',border:'3px solid #e5262b',background:'rgba(229,38,43,.18)',zIndex:2147483647,pointerEvents:'none',transition:'transform .08s'});document.documentElement.appendChild(c);const mv=e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';};for(const t of ['mousemove','pointermove','dragover','drag'])addEventListener(t,mv,true);addEventListener('mousedown',()=>{c.style.transform='scale(.7)';c.style.background='rgba(229,38,43,.45)';},true);addEventListener('mouseup',()=>{c.style.transform='';c.style.background='rgba(229,38,43,.18)';},true);});})()`;
export const at=s=>(Date.now()-s.t0)/1000;
// 기즈모 화면 좌표: 기본 카메라 방향 (9,8,11), 거리 D(카메라 거리 표시값)
import {pathToFileURL} from 'node:url';
const THREE=await import(pathToFileURL('C:/Users/ACE/Desktop/bobs_project/ai-3d-coedit/.worktrees/implementation/node_modules/three/build/three.module.js').href);
export async function projector(page,target=[0,0,0]){
 const box=await page.locator('canvas').first().boundingBox();const D=parseFloat(await page.getByLabel('카메라 거리').textContent());
 const dir=new THREE.Vector3(9,8,11).normalize(),T=new THREE.Vector3(...target);
 const cam=new THREE.PerspectiveCamera(45,box.width/box.height,.1,150);cam.position.copy(T.clone().add(dir.multiplyScalar(D)));cam.lookAt(T);cam.updateMatrixWorld();
 const factor=D*1.9*Math.tan(Math.PI/8)*.85/7;
 return (x,y,z,scaled=true)=>{const f=scaled?factor:1;const p=new THREE.Vector3(T.x+x*f,T.y+y*f,T.z+z*f).project(cam);return {x:box.x+(p.x+1)*box.width/2,y:box.y+(1-p.y)*box.height/2};};
}
export async function drag(page,a,b,steps=25){await page.mouse.move(a.x,a.y,{steps:8});await sleep(200);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps});await sleep(150);await page.mouse.up();}
