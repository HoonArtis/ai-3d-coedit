import {randomUUID} from 'node:crypto';
import type {Session} from '@coedit/contracts';
export type IssuedSession=Session&{roomKey:string};
export interface SessionResolver{read(token:unknown,roomKey:unknown):IssuedSession|Promise<IssuedSession>;}
export class SessionStore{
  private sessions=new Map<string,{session:IssuedSession;expires:number}>();
  issue(session:IssuedSession){
    const token=randomUUID();this.sessions.set(token,{session,expires:Date.now()+8*60*60*1000});return token;
  }
  read(token:unknown,roomKey:unknown):IssuedSession{
    const entry=typeof token==='string'?this.sessions.get(token):undefined;
    if(!entry||entry.expires<Date.now()||entry.session.roomKey!==roomKey)throw Error('UNAUTHENTICATED');
    return {...entry.session};
  }
}
