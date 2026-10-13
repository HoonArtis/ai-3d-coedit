import {Router,json,type ErrorRequestHandler} from 'express';
import {z} from 'zod';
import {idSchema} from '@coedit/contracts';
import {bearer} from '../accounts/routes';
import type {VrBakeService} from './bake-service';
export function vrRoutes(service:VrBakeService){
 const router=Router();
 router.post('/rooms/:roomId/vr',json({limit:'4kb'}),async(req,res)=>{
  const {requestId}=z.object({requestId:idSchema}).strict().parse(req.body),token=bearer(req),roomId=idSchema.parse(req.params.roomId);
  const submission=await service.submit(token,roomId,requestId);
  const registered=await service.register(token,roomId,submission.id);
  res.json({snapshotId:registered.snapshotId,seq:submission.seq});
 });
 router.get('/rooms/:roomId/vr',async(req,res)=>res.json(await service.list(bearer(req),idSchema.parse(req.params.roomId))));
 router.get('/rooms/:roomId/vr/:snapshotId',async(req,res)=>res.json(await service.environment(bearer(req),idSchema.parse(req.params.roomId),idSchema.parse(req.params.snapshotId))));
 router.get('/rooms/:roomId/vr/:snapshotId/glb',async(req,res)=>{
  const result=await service.artifact(bearer(req),idSchema.parse(req.params.roomId),idSchema.parse(req.params.snapshotId));
  res.setHeader('Cache-Control','private, no-store');res.type('model/gltf-binary').send(Buffer.from(result.bytes));
 });
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
  const code=error instanceof Error?error.message:'VR_FAILED';res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='VR_NOT_READY'?409:400).json({code,error:code==='VR_NOT_READY'?'VR 변환이 아직 완료되지 않았어요.':'VR 요청을 처리하지 못했어요.'});
 };router.use(errors);return router;
}
