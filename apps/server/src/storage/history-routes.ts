import {Router,type ErrorRequestHandler} from 'express';
import {idSchema} from '@coedit/contracts';
import {bearer} from '../accounts/routes';
import type {RoomHistoryService} from './room-history';
export function historyRoutes(history:RoomHistoryService){
  const router=Router();
  router.get('/rooms/:roomId/history',async(req,res)=>{
    res.json(await history.list(bearer(req),idSchema.parse(req.params.roomId),{...(req.query.objectId===undefined?{}:{objectId:req.query.objectId}),...(req.query.before===undefined?{}:{before:Number(req.query.before)}),...(req.query.limit===undefined?{}:{limit:Number(req.query.limit)})}));
  });
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{const code=error instanceof Error?error.message:'HISTORY_FAILED';res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:400).json({code,error:code==='FORBIDDEN'?'이 방의 이력을 열람할 수 없어요.':'이력을 읽지 못했어요.'});};router.use(errors);return router;
}
