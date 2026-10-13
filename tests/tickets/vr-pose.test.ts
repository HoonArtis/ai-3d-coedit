import {test,expect} from 'vitest';import {vrPoseSchema} from '@coedit/contracts';
import {poseFromFrame} from '../../apps/web/src/vr/pose';
test('head and controller poses use room origin; missing tracking never reuses previous hands',()=>{
 const reference={} as XRReferenceSpace,transform={position:{x:1,y:1.6,z:2},orientation:{x:0,y:0,z:0,w:1}},grip={} as XRSpace;
 const frame={getViewerPose:()=>({transform}),getPose:()=>({transform}),session:{inputSources:[{handedness:'left',gripSpace:grip}]}} as unknown as XRFrame;
 expect(poseFromFrame(frame,reference,[3,0,4],1)).toEqual({seq:1,head:{position:[4,1.6,6],quaternion:[0,0,0,1]},left:{position:[4,1.6,6],quaternion:[0,0,0,1]},right:null});
 frame.getPose=()=>undefined;expect(poseFromFrame(frame,reference,[0,0,0],2)?.left).toBeNull();frame.getViewerPose=()=>undefined;expect(poseFromFrame(frame,reference,[0,0,0],3)).toBeNull();
});
test('pose contract rejects identity spoofing, non-unit rotation and nonfinite coordinates',()=>{
 const pose={seq:1,head:{position:[0,1.6,0],quaternion:[0,0,0,1]},left:null,right:null};
 expect(vrPoseSchema.safeParse({...pose,actor:'fake'}).success).toBe(false);expect(vrPoseSchema.safeParse({...pose,head:{...pose.head,quaternion:[0,0,0,2]}}).success).toBe(false);expect(vrPoseSchema.safeParse({...pose,head:{...pose.head,position:[0,NaN,0]}}).success).toBe(false);
});
