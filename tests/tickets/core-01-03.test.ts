import { test, expect } from 'vitest';
import { parseCommand } from '../../packages/contracts/src/index';
const examples = [
  {op:'place',id:'o1',assetId:'chair',position:[0,0,0]},
  {op:'move',id:'o1',value:[1,0,2]}, {op:'rotate',id:'o1',value:[0,1,0]},
  {op:'scale',id:'o1',value:[1,2,1]}, {op:'delete',id:'o1'},
  {op:'duplicate',id:'o1',newId:'o2'}, {op:'rename',id:'o1',name:'의자'},
  {op:'snap_to_ground',id:'o1'}, {op:'generate',prompt:'고래 벤치'},
  {op:'upload_character',uploadId:'upload1'}, {op:'retexture',id:'o1',prompt:'나무'},
  {op:'arrange_around',targetId:'o1',assetId:'chair',ids:['a','b','c','d'],radius:2},
  {op:'align_row',ids:['a','b'],axis:'x',spacing:2},
  {op:'distribute',ids:['a','b'],axis:'x'},
  {op:'scatter',assetId:'tree',ids:['a','b'],min:[0,0,0],max:[10,0,10],seed:123},
  {op:'place_on',id:'a',targetId:'b'}, {op:'face_toward',id:'a',targetId:'b'},
  {op:'list'}, {op:'find',query:'의자'}, {op:'describe_scene'},
  {op:'undo'}, {op:'redo'}, {op:'lock',ids:['a']}, {op:'unlock',ids:['a']},
  {op:'force_unlock',ids:['a']}, {op:'approve_asset',artifactId:'a'},
  {op:'restore_object',id:'a',revision:1}, {op:'restore_snapshot',snapshotId:'s'},
  {op:'read_logs',studentId:'alice'},
];
test.each(examples)('validates declared operation $op', op => {
  const command = parseCommand({actor:'teacher',source:'teacher',requestId:'r',ops:[op]}, {actor:'teacher',role:'teacher'});
  expect(command.ops[0].op).toBe(op.op);
});
test.each([
  {op:'move',id:'a',value:[NaN,0,0]}, {op:'rotate',id:'a',value:[0,Infinity,0]},
  {op:'scale',id:'a',value:[1,0,1]}, {op:'scale',id:'a',value:[-1,1,1]},
  {op:'delete'}, {op:'delete',id:'__proto__'}, {op:'rename',id:'a',name:'   '},
  {op:'lock',ids:['a','a']}, {op:'focus',id:'a'}, {op:'missing'},
])('rejects malformed operation %j', op => {
  expect(()=>parseCommand({actor:'alice',source:'chat',requestId:'r',ops:[op]}, {actor:'alice',role:'student'})).toThrow();
});
