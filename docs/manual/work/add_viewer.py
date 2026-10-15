"""한눈에보기 확대 보기(타일 → 크게 열기, 좌우로 다음 단계) 템플릿 추가. 한 번만 실행."""
import pathlib
o = pathlib.Path(__file__).parent.parent / 'overview_template.html'
s = o.read_text(encoding='utf-8')
assert 'dialog#view' not in s, '이미 적용됨'
css = r"""
/* 확대 보기: 타일에서 커지며 열리고, 좌우로 다음 단계를 이어 봄 */
.tile{cursor:zoom-in}
dialog#view{border:0;padding:0;margin:0;width:100vw;height:100dvh;max-width:none;max-height:none;background:transparent;color:var(--ink);overflow:hidden}
dialog#view::backdrop{background:rgba(10,16,13,.55);backdrop-filter:blur(3px)}
.sheet{--c:var(--c1);position:absolute;inset:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));max-width:1360px;margin:0 auto;background:var(--surface);border-radius:14px;border-top:5px solid var(--c);box-shadow:0 20px 60px rgba(0,0,0,.35);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;transform-origin:center}
.sheet[data-lane="2"]{--c:var(--c2)}.sheet[data-lane="3"]{--c:var(--c3)}.sheet[data-lane="4"]{--c:var(--c4)}.sheet[data-lane="5"]{--c:var(--c5)}
.vhead{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.vhead .cat{font-weight:800;color:var(--c);font-family:var(--f-display)}
.vhead .key{font-size:12px;color:var(--muted)}
.vhead .prog{margin-left:auto;font:500 13px var(--f-mono);color:var(--muted)}
.vhead button,.vfoot button{font:inherit;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer}
.vhead button:hover,.vfoot button:hover{border-color:var(--c)}
.vbody{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);min-height:0}
.vmedia{background:var(--paper);display:grid;grid-template-rows:minmax(0,1fr) auto;gap:8px;padding:14px;min-height:0;min-width:0}
.vmedia .main{min-height:0;display:grid;place-items:center}
.vmedia .main img,.vmedia .main video{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;border:1px solid var(--line);background:var(--surface)}
.vmedia .noimg{color:var(--muted)}
.vmedia .thumbs{display:flex;gap:8px;overflow-x:auto}
.vmedia .thumbs button{flex:0 0 auto;padding:0;border:2px solid transparent;border-radius:6px;background:none;color:var(--ink);cursor:pointer;opacity:.6}
.vmedia .thumbs button[aria-current=true]{border-color:var(--c);opacity:1}
.vmedia .thumbs img{display:block;height:54px;border-radius:4px}
.vmedia .thumbs .vid{display:grid;place-items:center;height:54px;padding:0 12px}
.vtext{padding:22px 24px;overflow-y:auto;display:grid;gap:12px;align-content:start;min-width:0}
.vtext .top{display:flex;align-items:center;gap:8px}
.vtext .n{display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0 9px;border-radius:999px;background:var(--c);color:var(--surface);font:800 16px/1 var(--f-display)}
.vtext .n.soft{background:transparent;color:var(--c);border:1.5px dashed var(--c);font-size:13px}
.vtext h2{font-size:clamp(22px,2.4vw,30px)}
.vtext .lead{font-size:16px;font-weight:500;margin:0}
.vtext ul{margin:0;padding-left:1.2em;display:grid;gap:6px;font-size:15px;line-height:1.6}
.vtext .plan{justify-self:start;font-size:12px;font-weight:700;color:var(--mark);border:1px dashed var(--mark);border-radius:999px;padding:1px 10px}
.vtext .more{justify-self:start;font-weight:700;color:var(--c)}
.vfoot{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--line)}
.vfoot .prev{justify-self:start}.vfoot .next{justify-self:end}.vfoot button{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfoot .dots{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;align-items:center;max-width:460px}
.vfoot .dots i{width:7px;height:7px;border-radius:50%;background:var(--line)}.vfoot .dots i.on{background:var(--c);transform:scale(1.4)}
.vfoot .dots i.gap{margin-left:8px}
@media (max-width:820px){.vbody{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;overflow-y:auto}.vmedia .main img,.vmedia .main video{max-height:46vh}.vtext{overflow:visible}.vfoot .dots{display:none}.vfoot{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.vhead .key{display:none}}
"""
s = s.replace('</style>', css + '</style>', 1)
dlg = r"""
<dialog id="view" aria-label="기능 크게 보기">
 <div class="sheet" data-lane="1">
  <div class="vhead"><span class="cat"></span><span class="key">← → 이동 · Esc 닫기</span><span class="prog"></span><button type="button" class="close">닫기 ✕</button></div>
  <div class="vbody"><div class="vmedia"><div class="main"></div><div class="thumbs"></div></div>
   <div class="vtext"><div class="top"><span class="n"></span><span class="who"></span></div><h2></h2><p class="lead"></p><span class="plan" hidden>기획 · 구현 전 예시 화면</span><ul></ul><a class="more" href="#">전체 설명서에서 자세히 보기 →</a></div></div>
  <div class="vfoot"><button type="button" class="prev"></button><div class="dots" aria-hidden="true"></div><button type="button" class="next"></button></div>
 </div>
</dialog>
<script type="application/json" id="steps">{{STEPS}}</script>
<script>
(()=>{const S=JSON.parse(document.getElementById('steps').textContent),dlg=document.getElementById('view'),sheet=dlg.querySelector('.sheet'),$=q=>sheet.querySelector(q),tiles=[...document.querySelectorAll('a.tile[data-i]')];
const still=matchMedia('(prefers-reduced-motion: reduce)').matches,esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));let cur=0;
const dots=$('.dots');S.forEach((s,i)=>{const d=document.createElement('i');if(i&&S[i-1].lane!==s.lane)d.className='gap';dots.appendChild(d)});
function showMedia(m){const box=$('.main');box.innerHTML='';if(!m){box.innerHTML='<p class="noimg">화면 없음</p>';return}
 const el=document.createElement(m.t==='v'?'video':'img');el.src=m.u;if(m.t==='v'){el.muted=true;el.loop=true;el.autoplay=true;el.playsInline=true;el.controls=true}else el.alt=m.c;box.appendChild(el)}
function render(i){cur=(i+S.length)%S.length;const s=S[cur];sheet.dataset.lane=s.lane;
 $('.cat').textContent=String(s.lane).padStart(2,'0')+' '+s.cat;$('.prog').textContent=(cur+1)+' / '+S.length;
 const n=$('.vtext .n');n.textContent=s.badge;n.className='n'+(s.seq?'':' soft');const w=$('.vtext .who');w.textContent=s.who;w.className='who '+s.who;
 $('.vtext h2').textContent=s.title;$('.lead').textContent=s.desc;$('.vtext .plan').hidden=!s.plan;
 $('.vtext ul').innerHTML=s.lines.map(l=>'<li>'+esc(l)+'</li>').join('');$('.more').href='{{GUIDE}}#'+s.tid;
 showMedia(s.media[0]);const th=$('.thumbs');th.innerHTML='';
 if(s.media.length>1)s.media.forEach((m,k)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(k+1)+'번째 화면');b.setAttribute('aria-current',k===0);b.innerHTML=m.t==='v'?'<span class="vid">▶ 영상</span>':'<img src="'+m.u+'" alt="">';b.onclick=()=>{showMedia(m);th.querySelectorAll('button').forEach((x,j)=>x.setAttribute('aria-current',j===k))};th.appendChild(b)});
 const p=S[(cur-1+S.length)%S.length],q=S[(cur+1)%S.length];$('.prev').textContent='← '+p.title;$('.next').textContent=q.title+' →';
 dots.querySelectorAll('i').forEach((d,j)=>d.classList.toggle('on',j===cur));}
function go(d){if(still){render(cur+d);return}const body=$('.vbody');body.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateX('+(-d*40)+'px)'}],{duration:140,easing:'ease-in'}).onfinish=()=>{render(cur+d);body.animate([{opacity:0,transform:'translateX('+(d*40)+'px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'})}}
function zoom(rev){const t=tiles[cur];if(still||!t)return null;const a=t.getBoundingClientRect(),b=sheet.getBoundingClientRect();
 const k='translate('+(a.left+a.width/2-(b.left+b.width/2))+'px,'+(a.top+a.height/2-(b.top+b.height/2))+'px) scale('+(a.width/b.width)+','+(a.height/b.height)+')';
 const f=[{transform:k,opacity:.4},{transform:'none',opacity:1}];return sheet.animate(rev?f.reverse():f,{duration:rev?220:320,easing:'cubic-bezier(.2,.8,.2,1)'})}
function open(i){render(i);try{dlg.showModal()}catch(_){dlg.setAttribute('open','')}zoom(false)}
function close(){const t=tiles[cur];if(t)t.scrollIntoView({block:'nearest'});const a=zoom(true),end=()=>dlg.close();if(a)a.onfinish=end;else end()}
tiles.forEach(t=>t.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();open(+t.dataset.i)}));
$('.prev').onclick=()=>go(-1);$('.next').onclick=()=>go(1);$('.close').onclick=close;
dlg.addEventListener('cancel',e=>{e.preventDefault();close()});dlg.addEventListener('click',e=>{if(e.target===dlg)close()});
dlg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(1)}if(e.key==='ArrowLeft'){e.preventDefault();go(-1)}});
let sx=null;sheet.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')sx=e.clientX});sheet.addEventListener('pointerup',e=>{if(sx!==null&&Math.abs(e.clientX-sx)>60)go(e.clientX<sx?1:-1);sx=null});
window.__view={open,go,close,get cur(){return cur}};})();
</script>
"""
s = s.rstrip() + '\n' + dlg
s = s.replace('타일 클릭 시 전체 설명서의 해당 기능으로 이동.', '타일을 누르면 크게 열리고 ← → 로 다음 단계를 이어서 볼 수 있음.')
o.write_text(s, encoding='utf-8')
print('적용')
