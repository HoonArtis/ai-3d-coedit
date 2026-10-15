// 기획 예시 화면 촬영: 저장소 루트를 임시로 서빙해 three.js를 node_modules에서 읽는다
import {launch} from '../lib.mjs';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('../../..'),types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(0);
const port=srv.address().port,b=await launch(),p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('CON',m.text()));p.on('requestfailed',r=>console.log('FAIL',r.url()));p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});
for(const [v,name] of [['start','M9-02-match-start'],['prep','M9-03-prepare'],['seek','M9-04-seek'],['ghost','M9-05-ghost'],['result','M9-06-result'],['gun','M9-07-gun-blocks']]){
 await p.goto(`http://127.0.0.1:${port}/docs/manual/capture/plan_mock/mock.html?v=${v}&art=1`);await p.waitForFunction(()=>window.READY,null,{timeout:15000});await p.waitForTimeout(400);
 await p.screenshot({path:`../media/${name}.png`});console.log(name);
}
await b.close();srv.close();
