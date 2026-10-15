// GPT 장면 생성용 구도 참고 이미지(UI 없이 3D 영역만)
import {launch} from '../lib.mjs';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('../../..'),types={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(0);
const port=srv.address().port,b=await launch(),p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
for(const v of ['prep','seek','ghost','result','gun']){await p.goto(`http://127.0.0.1:${port}/docs/manual/capture/plan_mock/mock.html?v=${v}&clean=1`);await p.waitForFunction(()=>window.READY);await p.waitForTimeout(300);
 await p.locator('canvas').first().screenshot({path:`../work/scenes/ref/${v}.png`});console.log(v);}
await b.close();srv.close();
