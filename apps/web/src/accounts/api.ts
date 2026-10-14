export {serverEndpoint as apiEndpoint} from '../server-endpoint';
import {serverEndpoint as apiEndpoint} from '../server-endpoint';
import type {LoginIdentity} from '@coedit/contracts';
export type {LoginIdentity,Classroom,IssuedStudent} from '@coedit/contracts';
export async function accountApi<T>(path:string,body?:unknown,signal?:AbortSignal,sessionToken?:string):Promise<T>{
  const token=sessionToken===undefined?localStorage.getItem('coedit-account-token'):sessionToken;
  const response=await fetch(apiEndpoint+'/api'+path,{signal,method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){const error=await response.json().catch(()=>({error:'서버에 연결할 수 없어요.'}));throw Error(error.error??'요청에 실패했어요.');}
  if(response.status===204)return undefined as T;return response.json() as Promise<T>;
}
export function saveLogin(identity:LoginIdentity){localStorage.setItem('coedit-account-token',identity.token);localStorage.removeItem('coedit-account-identity');if(identity.roomKey)localStorage.setItem('coedit-account-identity',JSON.stringify(identity));}
export async function logout(){await accountApi('/logout',{});localStorage.removeItem('coedit-account-token');localStorage.removeItem('coedit-account-identity');location.assign('/?login=1');}
