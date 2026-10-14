import {Router,json,type ErrorRequestHandler} from 'express';
import {z} from 'zod';import {idSchema,objectKeySchema} from '@coedit/contracts';
import {bearer} from '../accounts/routes';import type {AssetService} from './service';
export function assetRoutes(service:AssetService){
 const router=Router();
 router.get('/classes/:classId/approvals',async(req,res)=>res.json(await service.listApprovals(bearer(req),idSchema.parse(req.params.classId))));
 router.post('/classes/:classId/approvals/:jobId',json({limit:'4kb'}),async(req,res)=>{
  const input=z.object({version:z.number().int().positive(),decision:z.enum(['approved','rejected'])}).strict().parse(req.body);
  res.json(await service.decide(bearer(req),idSchema.parse(req.params.classId),idSchema.parse(req.params.jobId),input.version,input.decision));
 });
 router.get('/rooms/:roomId/library',async(req,res)=>res.json(await service.library(bearer(req),idSchema.parse(req.params.roomId))));
 router.get('/rooms/:roomId/asset-history',async(req,res)=>res.json(await service.history(bearer(req),idSchema.parse(req.params.roomId))));
 router.post('/rooms/:roomId/assets/:artifactId/share',json({limit:'1kb'}),async(req,res)=>{
  z.object({}).strict().parse(req.body);res.json(await service.share(bearer(req),idSchema.parse(req.params.roomId),objectKeySchema.parse(req.params.artifactId)));
 });
 router.get('/assets/:artifactId/:kind',async(req,res)=>{
  const kind=z.enum(['glb','preview','avatar']).parse(req.params.kind),bytes=await service.file(bearer(req),objectKeySchema.parse(req.params.artifactId),kind==='preview',kind==='avatar');
  res.setHeader('Cache-Control','private, no-store');res.type('model/gltf-binary').send(Buffer.from(bytes));
 });
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{const code=error instanceof Error?error.message:'ASSET_FAILED';res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='DECISION_CONFLICT'?409:400).json({code,error:code==='FORBIDDEN'?'이 생성물에 접근할 수 없어요.':code==='DECISION_CONFLICT'?'이미 다른 결정이 저장됐어요.':'요청을 처리하지 못했어요.'});};router.use(errors);return router;
}
