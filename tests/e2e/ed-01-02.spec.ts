import {test,expect} from './fixture';
test('mouse wheel changes the camera but not the scene',async({page})=>{
  await page.goto('/');
  const status=page.getByLabel('카메라 거리');
  await expect(status).toBeVisible();
  const before=await status.textContent();
  await page.locator('canvas').hover();await page.mouse.wheel(0,-350);
  await expect(status).not.toHaveText(before!);
  await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
});
test('right drag and middle pan change the view while panel scrolling does not zoom',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  const canvas=page.locator('canvas'),box=(await canvas.boundingBox())!;
  const stable=async()=>{await expect.poll(async()=>{const a=await canvas.screenshot(),b=await canvas.screenshot();return a.equals(b);},{timeout:10000}).toBe(true);};
  await stable();const before=await canvas.screenshot();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+90,y+30,{steps:10});await page.mouse.up({button:'right'});
  await stable();const orbit=await canvas.screenshot();expect(orbit.equals(before)).toBe(false);
  await page.mouse.move(x,y);await page.mouse.down({button:'middle'});await page.mouse.move(x+70,y+40,{steps:10});await page.mouse.up({button:'middle'});
  await stable();expect((await canvas.screenshot()).equals(orbit)).toBe(false);
  const distance=await page.getByLabel('카메라 거리').textContent();await page.getByRole('heading',{name:'에셋 라이브러리'}).hover();await page.mouse.wheel(0,-350);
  await expect(page.getByLabel('카메라 거리')).toHaveText(distance!);await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
});
test('local camera buttons and missing focus do not change scene contents',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/선택 보기/}).click();await expect(page.getByRole('status',{name:'작업 안내'})).toContainText('먼저 에셋');
  const distance=await page.getByLabel('카메라 거리').textContent();await page.getByRole('button',{name:'확대',exact:true}).click();
  await expect(page.getByLabel('카메라 거리')).not.toHaveText(distance!);
  await page.getByRole('button',{name:'축소',exact:true}).click();await expect(page.getByLabel('카메라 거리')).toHaveText(distance!);
  await page.getByRole('button',{name:'카메라 궤도 회전'}).click();await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
});
