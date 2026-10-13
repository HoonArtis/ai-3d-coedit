import {test,expect} from 'vitest';
import {cameraCommand} from '../../apps/web/src/editor/camera';
import {scene} from '../fixtures/scene';
const current={position:[9,8,11] as [number,number,number],target:[0,0,0] as [number,number,number]};
test('focus, orbit and zoom modify local camera geometry without changing the scene',()=>{
  const snapshot=scene();snapshot.objects.a.position=[2,0,0];const before=structuredClone(snapshot);
  const focus=cameraCommand(current,{op:'focus',id:'a'},snapshot);expect(focus.target).toEqual([2,0,0]);
  expect(()=>cameraCommand(current,{op:'focus',id:'missing'},snapshot)).toThrow('NOT_FOUND');
  const orbit=cameraCommand(current,{op:'orbit',azimuth:.4,polar:0},snapshot);expect(orbit.position).not.toEqual(current.position);expect(orbit.target).toEqual(current.target);
  const zoom=cameraCommand(current,{op:'zoom',factor:.5},snapshot);expect(Math.hypot(...zoom.position)).toBeCloseTo(Math.hypot(...current.position)/2);
  expect(()=>cameraCommand(current,{op:'zoom',factor:NaN},snapshot)).toThrow();expect(snapshot).toEqual(before);
});


test('restoration retains a living focus and resets a deleted focus to the default view',async()=>{
 const {reconcileCameraFocus}=await import('../../apps/web/src/editor/camera');
 const current={position:[20,8,11] as [number,number,number],target:[11,0,0] as [number,number,number]};
 const snapshot=scene();expect(reconcileCameraFocus(current,'a',snapshot)).toEqual({camera:current,focusId:'a'});
 expect(reconcileCameraFocus(current,'deleted',snapshot)).toEqual({camera:{position:[9,8,11],target:[0,0,0]},focusId:null});
});
