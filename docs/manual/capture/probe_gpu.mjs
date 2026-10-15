import {launch,openStudent,shot,sleep} from './lib.mjs';
const b=await launch();const s=await openStudent(b,1);
console.log(await s.page.evaluate(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return c.getParameter(d.UNMASKED_RENDERER_WEBGL);}));
await s.page.getByRole('button',{name:'둥근 테이블 배치'}).dblclick();await sleep(1500);await shot(s.page,'x_probe');
console.log('scene items',await s.page.locator('[aria-label$=" 선택"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))));
await b.close();
