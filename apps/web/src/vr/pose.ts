import {vrPoseSchema,type Vec3,type VrPose} from '@coedit/contracts';
export function poseFromFrame(frame:XRFrame,reference:XRReferenceSpace,origin:Vec3,seq:number):VrPose|null{
 const head=frame.getViewerPose(reference);if(!head)return null;
 const convert=(transform:XRRigidTransform):VrPose['head']=>({position:[transform.position.x+origin[0],transform.position.y+origin[1],transform.position.z+origin[2]],quaternion:[transform.orientation.x,transform.orientation.y,transform.orientation.z,transform.orientation.w]});
 const result:VrPose={seq,head:convert(head.transform),left:null,right:null};
 for(const input of frame.session.inputSources){
  if(input.handedness!=='left'&&input.handedness!=='right')continue;
  const wrist=input.hand?.get('wrist'),pose=wrist?frame.getJointPose?.(wrist,reference):input.gripSpace?frame.getPose(input.gripSpace,reference):undefined;
  if(pose)result[input.handedness]=convert(pose.transform);
 }
 const parsed=vrPoseSchema.safeParse(result);return parsed.success?parsed.data:null;
}
