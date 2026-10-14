import {Router,json,raw,type Request,type ErrorRequestHandler} from 'express';
import {z} from 'zod';
import {confirmImageSchema,idSchema,materialPresetSchema} from '@coedit/contracts';
import type {AccountService} from '../accounts/service';
import {bearer} from '../accounts/routes';
import type {RoomRepository} from '../storage/room-repository';
import type {ImageService} from './image-service';
import {generationMessage} from './command';
export function generationRoutes(accounts:AccountService,images:ImageService,rooms:RoomRepository){
 const router=Router();
 const scope=(req:Request)=>accounts.resolveRoomToken(bearer(req),idSchema.parse(req.params.roomId));
 router.get('/:roomId',async(req,res)=>{const s=await scope(req);res.json({jobs:await images.progress(s),usage:await images.repository.usage(s)});});
 router.get('/:roomId/:jobId/image',async(req,res)=>{const bytes=await images.image(await scope(req),idSchema.parse(req.params.jobId));res.setHeader('Cache-Control','private, no-store');res.type('png').send(Buffer.from(bytes));});
 router.post('/:roomId/upload/:requestId',raw({type:()=>true,limit:'10mb'}),async(req,res)=>{
  const s=await scope(req),requestId=idSchema.parse(req.params.requestId);
  if(!Buffer.isBuffer(req.body))throw Error('IMAGE_FORMAT');
  const generation=(await rooms.load(s.roomKey))?.snapshot.generation??0;
  res.status(201).json(await images.upload(s,generation,requestId,req.body));
 });
 router.post('/:roomId/characters/:requestId/:format',raw({type:()=>true,limit:'64mb'}),async(req,res)=>{
  const s=await scope(req),requestId=idSchema.parse(req.params.requestId),format=z.enum(['fbx','glb']).parse(req.params.format);
  if(!Buffer.isBuffer(req.body))throw Error('CHARACTER_FORMAT');
  const generation=(await rooms.load(s.roomKey))?.snapshot.generation??0;
  res.status(201).json(await images.uploadCharacter(s,generation,requestId,req.body,format,'업로드한 캐릭터'));
 });
 router.post('/:roomId/:jobId/cancel',json({limit:'4kb'}),async(req,res)=>{
  const s=await scope(req),{version}=confirmImageSchema.parse(req.body);res.json(await images.cancel(s,idSchema.parse(req.params.jobId),version));
 });
 router.post('/:roomId/:jobId/visibility',json({limit:'4kb'}),async(req,res)=>{
  const s=await scope(req),input=z.object({version:z.number().int().positive(),visibility:z.enum(['visible','hidden','deleted'])}).strict().parse(req.body);
  res.json(await images.repository.visibility(s,idSchema.parse(req.params.jobId),input.version,input.visibility));
 });
 router.post('/:roomId/:jobId/confirm',json({limit:'4kb'}),async(req,res)=>{
  const s=await scope(req),{version}=confirmImageSchema.parse(req.body);
  res.json(await images.confirm(s,idSchema.parse(req.params.jobId),version));
 });
 router.post('/:roomId/:jobId/redraw',json({limit:'8kb'}),async(req,res)=>{
  const s=await scope(req),input=z.object({requestId:idSchema,version:z.number().int().positive(),prompt:z.string().min(1).max(2000)}).strict().parse(req.body);
  const generation=(await rooms.load(s.roomKey))?.snapshot.generation??0;
  res.json(await images.text(s,generation,input.requestId,input.prompt,{jobId:idSchema.parse(req.params.jobId),expectedVersion:input.version}));
 });
 router.post('/:roomId/:jobId/preset',json({limit:'4kb'}),async(req,res)=>{
  const s=await scope(req),input=z.object({version:z.number().int().positive(),preset:materialPresetSchema}).strict().parse(req.body);
  if(!images.finishing)throw Error('FINISHING_UNAVAILABLE');
  res.json(await images.finishing.choosePreset(s,idSchema.parse(req.params.jobId),input.version,input.preset));
 });
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
  const code=error instanceof Error?error.message:'GENERATION_FAILED';res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='GENERATION_LIMIT'?409:400).json({code,message:generationMessage(code)});
 };router.use(errors);return router;
}
