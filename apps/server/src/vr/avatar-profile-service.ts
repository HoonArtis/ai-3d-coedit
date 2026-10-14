import {readFile} from 'node:fs/promises';
import {blockAvatarSchema} from '@coedit/contracts';
import type {AccountService} from '../accounts/service';
export class AvatarProfileService{
 constructor(private accounts:AccountService){}
 async migrate(){await this.accounts.pool.query(await readFile(new URL('../../../../infra/migrations/013-avatar-profiles.sql',import.meta.url),'utf8'));}
 async forActor(actor:string,roomId:string){const {rows}=await this.accounts.pool.query('SELECT profile FROM coedit_avatar_profiles WHERE room_id=$1 AND actor=$2',[roomId,actor]);return rows.length?blockAvatarSchema.parse(rows[0].profile):null;}
 async read(token:string,roomId:string){const session=await this.accounts.resolveRoomToken(token,roomId);return this.forActor(session.actor,roomId);}
 async save(token:string,roomId:string,raw:unknown){
  const session=await this.accounts.resolveRoomToken(token,roomId),profile=blockAvatarSchema.nullable().parse(raw);
  if(profile)await this.accounts.pool.query('INSERT INTO coedit_avatar_profiles(room_id,actor,profile) VALUES($1,$2,$3) ON CONFLICT(room_id,actor) DO UPDATE SET profile=EXCLUDED.profile',[roomId,session.actor,JSON.stringify(profile)]);
  else await this.accounts.pool.query('DELETE FROM coedit_avatar_profiles WHERE room_id=$1 AND actor=$2',[roomId,session.actor]);
  return profile;
 }
}
