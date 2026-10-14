import {test,expect} from 'vitest';
import {applyCommand} from '@coedit/domain';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {context,command,scene} from '../fixtures/scene';

const privateAsset={...context.library.chair,id:'private',creator:'alice',shared:false};
const library={...context.library,private:privateAsset};
const place={op:'place',id:'new',assetId:'private',position:[0,0,0]};
test('private asset guessed IDs cannot be placed; creator, teacher and explicitly shared assets can',()=>{
 for(const [actor,role,allowed] of [['bob','student',false],['alice','student',true],['teacher','teacher',true]] as const){
  expect(applyCommand(scene(),command([place],{actor,source:role==='teacher'?'teacher':'gizmo'}),{...context,actor,role,library}).ok).toBe(allowed);
 }
 expect(applyCommand(scene(),command([place],{actor:'bob'}),{...context,actor:'bob',library:{...library,private:{...privateAsset,shared:true}}}).ok).toBe(true);
});
test('replacement and duplication cannot introduce another creator private asset',()=>{
 const input=scene();input.objects.a.owner='bob';
 const ctx={...context,actor:'bob',library,locks:{a:{owner:'bob',token:'lease1'}}};
 expect(applyCommand(input,command([{op:'replace_asset',id:'a',assetId:'private',expectedRevision:1,expectedGeneration:0}],{actor:'bob'}),ctx)).toMatchObject({ok:false,code:'ASSET_UNAVAILABLE'});
 input.objects.a.assetId='private';
 expect(applyCommand(input,command([{op:'duplicate',id:'a',newId:'copy'}],{actor:'bob'}),ctx)).toMatchObject({ok:false,code:'ASSET_UNAVAILABLE'});
});
test('room peers receive placed private models for rendering but cannot place their own copies',()=>{
 const room=new RoomService('room',library);
 room.join('a',{actor:'alice',role:'student'});room.join('b',{actor:'bob',role:'student'});room.join('t',{actor:'teacher',role:'teacher'});
 expect(room.getLibraryFor('a').private).toBeDefined();expect(room.getLibraryFor('t').private).toBeDefined();expect(room.getLibraryFor('b').private).toBeUndefined();
 expect(room.submit('a',command([place])).ok).toBe(true);
 expect(room.getLibraryFor('b').private).toEqual(privateAsset);
 expect(room.submit('b',command([{...place,id:'copy'}],{actor:'bob'}))).toMatchObject({ok:false,code:'ASSET_UNAVAILABLE'});
 expect(room.getLibrary().private).toEqual(privateAsset);
});
