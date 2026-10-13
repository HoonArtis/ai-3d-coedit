import {lazy,Suspense} from 'react';
import {Editor} from './editor/Editor';
import {Login} from './accounts/Login';
import {Dashboard} from './accounts/Dashboard';
const VrLobby=lazy(()=>import('./vr/VrLobby'));
export function App(){const params=new URLSearchParams(location.search);return params.has('vr')?<Suspense fallback={<p>VR 화면 준비 중…</p>}><VrLobby roomId={params.get('vr')!}/></Suspense>:params.has('login')?<Login/>:params.has('teacher')?<Dashboard/>:<Editor/>;}
