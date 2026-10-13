import {test,expect} from './fixture';
import {PerspectiveCamera,Vector3} from 'three';
test('real rotation and scale handles commit and invalid scale rolls back',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'컬러 블록 배치'}).dblclick();await expect(page.getByLabel('위치 X')).toBeEnabled();
  const box=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(45,box.width/box.height,.1,150);camera.position.set(9,8,11);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const factor=camera.position.length()*1.9*Math.tan(Math.PI/8)*.85/7;
  const point=(x:number,y:number,z:number)=>{const p=new Vector3(x*factor,y*factor,z*factor).project(camera);return {x:box.x+(p.x+1)*box.width/2,y:box.y+(1-p.y)*box.height/2};};
  const drag=async(a:{x:number;y:number},b:{x:number;y:number})=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();};
  await page.keyboard.press('e');await expect(page.getByRole('button',{name:'회전 모드'})).toHaveAttribute('aria-pressed','true');
  await drag(point(Math.cos(.3),0,Math.sin(.3)),point(Math.cos(.8),0,Math.sin(.8)));
  await expect.poll(async()=>{let sum=0;for(const axis of ['X','Y','Z'])sum+=Math.abs(Number(await page.getByLabel('회전 '+axis).inputValue()));return sum;}).toBeGreaterThan(1);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByLabel('회전 Y')).toHaveValue('0');
  await page.keyboard.press('r');await drag(point(0,.8,0),point(0,1.2,0));
  await expect.poll(async()=>Number(await page.getByLabel('크기 Y').inputValue())).toBeGreaterThan(1.1);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByLabel('크기 Y')).toHaveValue('1');
  await drag(point(0,.8,0),point(0,-.3,0));
  await expect(page.getByRole('status',{name:'작업 안내'})).toBeVisible();await expect(page.getByLabel('크기 Y')).toHaveValue('1');
});
test('escape cancels a drag without adding undo history',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await expect(page.getByLabel('위치 Y')).toBeEnabled();
  const box=(await page.locator('canvas').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  await page.keyboard.press('w');await page.mouse.move(x,y-65);await page.mouse.down();await page.mouse.move(x,y-130,{steps:10});await page.keyboard.press('Escape');await page.mouse.up();
  await page.getByRole('button',{name:'라운지 의자 선택'}).click();await expect(page.getByLabel('위치 Y')).toHaveValue('0');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
});
test('library drag adds one object and unknown drop payload adds none',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'화분 배치'}).dragTo(page.locator('canvas'));
  await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
  const data=await page.evaluateHandle(()=>{const data=new DataTransfer();data.setData('coedit/asset','missing');return data;});
  await page.locator('.viewport').dispatchEvent('drop',{dataTransfer:data,clientX:600,clientY:400});
  await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
});
