import {test,expect} from './fixture';
test('five separate browsers receive the same changes and cannot edit another owner',async({browser,baseURL})=>{
  const contexts=await Promise.all(Array.from({length:5},()=>browser.newContext()));
  try{
    const pages=await Promise.all(contexts.map(c=>c.newPage()));
    for(const page of pages){await page.goto(baseURL!);await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();}
    await pages[0].getByRole('button',{name:'공원 벤치 배치'}).dblclick();
    for(const page of pages)await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
    await pages[1].getByRole('button',{name:'공원 벤치 선택'}).click();
    await expect(pages[1].getByRole('status',{name:'작업 안내'})).toContainText('FORBIDDEN');
    await expect(pages[1].getByLabel('위치 X')).toHaveCount(0);
    await pages[0].getByLabel('위치 X').fill('3');await pages[0].getByLabel('위치 X').press('Enter');
    await expect(pages[0].getByLabel('위치 X')).toHaveValue('3');
    await pages[0].getByRole('button',{name:'삭제',exact:true}).click();
    for(const page of pages)await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
  }finally{
    // BrowserContext.close is a crash-like teardown; navigate first to exercise pagehide/consented leave.
    for(const context of contexts)for(const page of context.pages())await page.goto('about:blank');
    await Promise.all(contexts.map(c=>c.close()));
  }
});
