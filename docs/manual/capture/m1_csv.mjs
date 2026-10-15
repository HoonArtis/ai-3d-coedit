// M1-07 보강: 발급 ID CSV 실제 다운로드 확인
import {launch,api,loadState,openTeacher,sleep} from './lib.mjs';
import fs from 'node:fs';
const st=loadState(),b=await launch();
const cls=await api('/classes',{token:st.teacher.token}),ic=(cls.classes||cls).find(x=>x.id===st.issueClass);
for(const r of ic.rooms){const l=await api('/rooms/'+r.id+'/students',{token:st.teacher.token});for(const s of l.seats||[])if(s.actor)await api('/rooms/'+r.id+'/students/'+s.actor+'/manage',{token:st.teacher.token,body:{action:'remove'}});}
const t=await openTeacher(b),p=t.page;const h=p.getByRole('heading',{name:'발급 ID 시연'});await h.waitFor();
const hb=await h.boundingBox();let best=null,d=1e9;for(const x of await p.getByRole('button',{name:/학생 \d+명 발급/}).all()){const bb=await x.boundingBox();if(Math.abs(bb.y-hb.y)<d){d=Math.abs(bb.y-hb.y);best=x;}}
await best.click();await sleep(1200);
const [dl]=await Promise.all([p.waitForEvent('download'),p.getByText('발급 ID 내려받기').first().click()]);
const f=await dl.path(),txt=fs.readFileSync(f,'utf8');
console.log('file',dl.suggestedFilename());console.log(txt.split(/\r?\n/).slice(0,3).join('\n').replace(/,[A-Za-z0-9_-]{12,}$/gm,',<id>'));console.log('rows',txt.trim().split(/\r?\n/).length);
await b.close();
