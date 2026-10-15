// GPT 파노라마를 3D 배경으로 깐 비교 이미지 촬영. 인자: id:제목 ...
import {launch} from '../lib.mjs';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('../../..'),types={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(0);
const port=srv.address().port,b=await launch(),p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();p.on('pageerror',e=>console.log('ERR',e.message));
for(const arg of process.argv.slice(2)){const [id,title]=arg.split(':');
 await p.goto(`http://127.0.0.1:${port}/docs/manual/capture/plan_mock/backdrop.html?v=none&img=/docs/manual/work/backdrops/${id}.png&t=${encodeURIComponent(title)}`);
 await p.waitForFunction(()=>window.READY,null,{timeout:20000});await p.waitForTimeout(300);await p.screenshot({path:`../work/backdrops/render_${id}.png`});console.log(id);}
await b.close();srv.close();
