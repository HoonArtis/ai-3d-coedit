// M8-03/04/05 주석 보정: 기존 제출본 미리보기 화면 재촬영
import {launch,openStudent,shot,sleep,WEB} from './lib.mjs';
import {annotate} from './tools.mjs';
const b=await launch();const s=await openStudent(b,2);const p=s.page;
await p.getByRole('link',{name:'VR 감상'}).click();await sleep(2000);
await p.getByRole('button',{name:/제출본.*미리보기/}).first().click();await p.getByText(/읽기 전용 장면 준비 완료/).first().waitFor({timeout:60000});await sleep(2500);
const enter=p.getByRole('button',{name:'VR 입장'});
const msg=p.locator('text=이 브라우저는 VR 세션을 지원하지 않아요.').first();
const ready=p.locator('text=/읽기 전용 장면 준비 완료/').first();
const cv=await p.locator('canvas').first().boundingBox();
const viewers=p.getByLabel('함께 감상하는 사람');
const src=await shot(p,'m8_preview2');
await annotate(src,'M8-03-readonly-preview',[{box:await ready.boundingBox(),n:1,label:'읽기 전용 장면 준비 완료'},{box:{x:cv.x+cv.width*.3,y:cv.y+cv.height*.3,width:cv.width*.4,height:cv.height*.5},n:2,label:'제출본 3D 장면'}]);
await annotate(src,'M8-04-vr-enter',[{box:await enter.boundingBox(),n:1,label:'VR 입장',side:'below'},{box:await msg.boundingBox(),n:2,label:'PC 브라우저 미지원 안내',side:'right'}]);
await annotate(src,'M8-05-viewers',[{box:await viewers.boundingBox(),n:1,label:'함께 감상하는 사람(인원)',side:'right'}]);
console.log(await msg.boundingBox(),await viewers.boundingBox());
await b.close();
