import document from '../budgets.json' with {type:'json'};
import { z } from 'zod';
export const BUDGETS = Object.freeze(document);
export function roomCapacityMessage(count:number):string|null{
  if(count<BUDGETS.roomAssets*.9)return null;
  const remaining=Math.max(0,BUDGETS.roomAssets-count);
  return remaining?`공간이 거의 찼어요. 에셋을 ${remaining}개 더 놓을 수 있어요.`:'방이 가득 찼어요. 새 에셋을 놓으려면 먼저 기존 에셋을 지워 주세요.';
}
const schema=z.object(Object.fromEntries(Object.entries(document).map(([key,value])=>[key,z.literal(value)]))).strict();
export function parseBudgets(value:unknown):typeof document {
  return schema.parse(value) as typeof document;
}
