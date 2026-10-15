// M5-12 근접 촬영: 생성 에셋 선택 보기 후 선택 해제 상태
import {launch,openStudent,shot,sleep,clearMine} from './lib.mjs';
import {annotate,zoom} from './tools.mjs';
const b=await launch();const s2=await openStudent(b,2);await clearMine(s2.page);await s2.ctx.close();
const s=await openStudent(b,1);const p=s.page;
await p.locator('.scene-list button[aria-label$=" 선택"]').first().click();await sleep(400);
await p.locator('.focus-button').click();await sleep(1200);
for(let i=0;i<8;i++){const D=parseFloat(await p.getByLabel('카메라 거리').textContent());if(D>4.6){await p.getByRole('button',{name:'확대',exact:true}).click();await sleep(200);}else break;}
console.log('dist',await p.getByLabel('카메라 거리').textContent());
await p.keyboard.press('Escape');await sleep(1200);
const vb=await p.locator('.viewport').boundingBox();const src=await shot(p,'m5_closeup');
await zoom(src,'M5-12-model-zoom',{x:vb.x+vb.width*.15,y:vb.y+vb.height*.08,width:vb.width*.7,height:vb.height*.84},{margin:0});
await b.close();
