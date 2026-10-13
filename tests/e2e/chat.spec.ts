import {test,expect} from './fixture';
test('real local model places four chairs as one command and restores private chat after reload',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'둥근 테이블 배치'}).dblclick();await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
 await page.getByLabel('AI에게 요청').fill('선택한 탁자 주위에 새 의자 4개를 반경 2m로 배치해 줘');
 await page.getByRole('button',{name:'AI 요청 보내기'}).click();
 await expect(page.getByLabel('에셋 수')).toHaveText('5 / 200',{timeout:60000});
 await expect(page.getByRole('log',{name:'내 AI 대화'})).toContainText('완료');
 await page.getByRole('button',{name:'방금 거 취소',exact:true}).click();await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
 await page.reload();await expect(page.getByRole('log',{name:'내 AI 대화'})).toContainText('선택한 탁자 주위');
});
