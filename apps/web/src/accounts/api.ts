export const apiEndpoint=import.meta.env.VITE_SERVER_URL??'http://127.0.0.1:2567';
import type {LoginIdentity} from '@coedit/contracts';
export type {LoginIdentity,Classroom,IssuedStudent} from '@coedit/contracts';
export async function accountApi<T>(path:string,body?:unknown):Promise<T>{
  const token=localStorage.getItem('coedit-account-token');
  const response=await fetch(apiEndpoint+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){const error=await response.json().catch(()=>({error:'서버에 연결할 수 없어요.'}));throw Error(error.error??'요청에 실패했어요.');}
  if(response.status===204)return undefined as T;return response.json() as Promise<T>;
}
export function saveLogin(identity:LoginIdentity){localStorage.setItem('coedit-account-token',identity.token);localStorage.removeItem('coedit-account-identity');if(identity.roomKey)localStorage.setItem('coedit-account-identity',JSON.stringify(identity));}
export async function logout(){await accountApi('/logout',{});localStorage.removeItem('coedit-account-token');localStorage.removeItem('coedit-account-identity');location.assign('/?login=1');}
