import {test as base,expect} from '@playwright/test';
export const test=base.extend({
  page:async({page},use)=>{await use(page);if(!page.isClosed())await page.goto('about:blank');},
});
export {expect};
