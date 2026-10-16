import {test,expect} from './fixture';
import {PerspectiveCamera,Vector3} from 'three';
test('dragging the up (Unreal Z) handle commits a transform and undo restores it',async({page})=>{
  await page.goto('/');
  await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();
  await expect(page.getByLabel('위치 Z')).toBeEnabled();
  const box=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(45,box.width/box.height,.1,150);camera.position.set(9,8,11);camera.lookAt(0,0,0);camera.updateMatrixWorld();const factor=camera.position.length()*1.9*Math.tan(Math.PI/8)*.85/7;const p=new Vector3(0,.8*factor,0).project(camera),x=box.x+(p.x+1)*box.width/2,y=box.y+(1-p.y)*box.height/2;
  const distance=await page.getByLabel('카메라 거리').textContent();
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x,y-65,{steps:12});await page.mouse.up();
  await expect.poll(async()=>Number(await page.getByLabel('위치 Z').inputValue())).toBeGreaterThan(10);
  await expect(page.getByLabel('카메라 거리')).toHaveText(distance!);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await expect(page.getByLabel('위치 Z')).toHaveValue('0');
});
