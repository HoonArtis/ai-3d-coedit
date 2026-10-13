import {lazy,Suspense,useEffect,useState} from 'react';
import {serverEndpoint} from './server-endpoint';
import {Editor} from './editor/Editor';
import {Login} from './accounts/Login';
import {Dashboard} from './accounts/Dashboard';
const VrLobby=lazy(()=>import('./vr/VrLobby'));
export function App(){
 const [config,setConfig]=useState<{localPreview:boolean;registrationEnabled:boolean}|null>(null),[failed,setFailed]=useState(false);
 const [role,setRole]=useState<'teacher'|'student'|null>(null);
 useEffect(()=>{const abort=new AbortController();void (async()=>{
  const response=await fetch(serverEndpoint+'/api/runtime-config',{signal:abort.signal});if(!response.ok)throw Error('CONFIG');const next=await response.json();
  const token=localStorage.getItem('coedit-account-token');
  if(!next.localPreview&&token){const session=await fetch(serverEndpoint+'/api/me',{headers:{Authorization:'Bearer '+token},signal:abort.signal});
   if(session.status===401){localStorage.removeItem('coedit-account-token');localStorage.removeItem('coedit-account-identity');}
   else{if(!session.ok)throw Error('SESSION');setRole((await session.json()).role);}
  }
  setConfig(next);
 })().catch(()=>{if(!abort.signal.aborted)setFailed(true);});return()=>abort.abort();},[]);
 if(failed)return <main><p>서버에 연결할 수 없어요. 잠시 뒤 새로고침해 주세요.</p></main>;
 if(!config)return <p>연결 준비 중…</p>;
 const params=new URLSearchParams(location.search);
 if(params.has('login')||(!config.localPreview&&!localStorage.getItem('coedit-account-token')))return <Login {...config}/>;
 if(!config.localPreview&&!params.has('vr')&&!localStorage.getItem('coedit-account-identity'))return role==='teacher'?<Dashboard/>:<Login {...config}/>;
 return params.has('vr')?<Suspense fallback={<p>VR 화면 준비 중…</p>}><VrLobby roomId={params.get('vr')!}/></Suspense>:params.has('teacher')?<Dashboard/>:<Editor/>;
}
