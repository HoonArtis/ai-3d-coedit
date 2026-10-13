import {BUILTIN_LIBRARY,dashboardSchema} from '@coedit/contracts';
import type {AccountService} from './service';import type {RoomRepository} from '../storage/room-repository';import type {AssetService} from '../assets/service';
export class DashboardService{
 constructor(private accounts:AccountService,private rooms:RoomRepository,private assets:Pick<AssetService,'catalogForRoom'>){}
 async overview(token:string){
  const classes=await this.accounts.listClasses(token);
  return dashboardSchema.parse(await Promise.all(classes.map(async c=>({
   ...c,library:{...BUILTIN_LIBRARY,...(c.rooms[0]?await this.assets.catalogForRoom(c.rooms[0].id):{})},
   rooms:await Promise.all(c.rooms.map(async(r:{id:string})=>{
    const pendingApproval=(await this.accounts.pool.query("SELECT count(*)::int AS n FROM coedit_generation_finishing f JOIN coedit_generation_jobs j ON j.id=f.job_id WHERE j.room_id=$1 AND f.phase='pending_approval'",[r.id])).rows[0].n;
    try{return {...r,pendingApproval,snapshot:(await this.rooms.load(r.id))?.snapshot??null,thumbnailError:false};}
    catch{return {...r,pendingApproval,snapshot:null,thumbnailError:true};}
   })),
  }))));
 }
}
