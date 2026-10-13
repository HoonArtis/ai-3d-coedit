import {StudentConnections} from './accounts/student-connections';
import {StudentManagement} from './accounts/student-management';
import {studentManagementRoutes} from './accounts/student-management-routes';
import {removeStudentObjects} from './rooms/remove-student-objects';
import {inviteRoutes} from './accounts/invite-routes';
import {mountWebSurface} from './web-surface';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {randomUUID} from 'node:crypto';
import {SessionStore} from './accounts/session-store';
import {createStudioRoom} from './rooms/colyseus-room';
import type {RoomRepository} from './storage/room-repository';
import type {AccountService} from './accounts/service';
import {accountRoutes} from './accounts/routes';
import type {ChatService} from './chat/service';
import type {ImageService} from './generation/image-service';
import {generationRoutes} from './generation/routes';
import type {AssetService} from './assets/service';
import {assetRoutes} from './assets/routes';
import {DashboardService} from './accounts/dashboard';
import type {RoomHistoryService} from './storage/room-history';
import {historyRoutes} from './storage/history-routes';
import {TeacherLogService} from './accounts/teacher-logs';
import {logRoutes} from './accounts/log-routes';
import type {VrBakeService} from './vr/bake-service';
import {vrRoutes} from './vr/routes';
import {RoomCapacity} from './rooms/capacity';
import {createViewingRoom} from './vr/viewing-room';
import type {RetextureService} from './generation/retexture-service';
export async function startServer(port=2567,localPreview=false,options:{repository?:RoomRepository;accounts?:AccountService;chat?:ChatService;images?:ImageService;assets?:AssetService;history?:RoomHistoryService;vr?:VrBakeService;retexture?:RetextureService;webRoot?:string;registrationEnabled?:boolean}={}){
  const sessions=new SessionStore(),connections=new StudentConnections();let endpoint='';
  // The upstream 4 KiB default rejects valid 200-op commands and 4000-character Korean chat.
  const transport=new WebSocketTransport({maxPayload:256*1024});
  const app=transport.getExpressApp();
  app.use((req,res,next)=>{
    const origin=req.headers.origin;
    if(origin){
      let host='';try{host=new URL(origin).hostname;}catch{}
      if(!['127.0.0.1','localhost'].includes(host)&&origin!==process.env.ALLOWED_ORIGIN){res.status(403).end();return;}
      res.header('Access-Control-Allow-Origin',origin);res.header('Vary','Origin');
      res.header('Access-Control-Allow-Headers','Content-Type, Authorization');res.header('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    if(req.method==='OPTIONS'){res.status(204).end();return;}next();
  });
  app.get('/api/runtime-config',(_req,res)=>res.json({localPreview,registrationEnabled:options.registrationEnabled??true}));
  app.get('/health',(_req,res)=>res.json({ok:true,mode:localPreview?'local-preview':'authenticated',storage:options.repository?'postgres':'memory'}));
  if(localPreview)app.post('/api/local-session',(req,res)=>{
    const origin=req.headers.origin;
    if(origin){
      let host='';try{host=new URL(origin).hostname;}catch{/* invalid origin */}
      if(!['127.0.0.1','localhost'].includes(host)){res.status(403).end();return;}
      res.header('Access-Control-Allow-Origin',origin);res.header('Vary','Origin');
    }
    const session={actor:'student-'+randomUUID(),role:'student' as const,roomKey:'local-room'};
    const token=sessions.issue(session);res.json({token,...session,storage:'memory'});
  });
  if(options.accounts&&options.images&&options.repository)app.use('/api/generation',generationRoutes(options.accounts,options.images,options.repository));
  if(options.assets)app.use('/api',assetRoutes(options.assets));
  if(options.vr)app.use('/api',vrRoutes(options.vr));
  if(options.history)app.use('/api',historyRoutes(options.history));
  if(options.accounts)app.use('/api',logRoutes(new TeacherLogService(options.accounts)));
  if(options.accounts)app.use('/api',inviteRoutes(options.accounts));
  if(options.accounts)app.use('/api',accountRoutes(options.accounts,options.repository&&options.assets?new DashboardService(options.accounts,options.repository,options.assets):undefined,options.registrationEnabled));
  if(options.accounts)app.use('/api',studentManagementRoutes(new StudentManagement(options.accounts,connections,async(token,roomId,actor)=>removeStudentObjects(endpoint,token,roomId,(await options.accounts!.session(token)).actor,actor))));
  if(options.webRoot)mountWebSurface(app,options.webRoot);
  const resolver={read:async(token:unknown,roomKey:unknown)=>{
    try{return sessions.read(token,roomKey);}catch(error){if(!options.accounts)throw error;return options.accounts.resolveRoomToken(token,roomKey);}
  }};
  const server=new Server({transport,gracefullyShutdown:false,greet:false});
  const capacity=new RoomCapacity();
  server.define('studio',createStudioRoom(resolver,options.repository,localPreview,options.chat,options.images,options.assets,options.history,capacity,options.retexture,connections)).filterBy(['roomKey']);
  if(options.vr)server.define('viewing',createViewingRoom(resolver,options.vr,capacity,connections)).filterBy(['roomKey','snapshotId']);
  await server.listen(port,'127.0.0.1');
  const address=transport.server!.address();
  if(!address||typeof address==='string')throw Error('Missing server address');
  endpoint='http://127.0.0.1:'+address.port;
  return {url:endpoint,sessions,close:()=>server.gracefullyShutdown(false)};
}
