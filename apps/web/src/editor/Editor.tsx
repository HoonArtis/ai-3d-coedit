import {useEffect,useState} from 'react';
import {roomCapacityMessage} from '@coedit/contracts';
import {ChatPanel} from './ChatPanel';
import {GenerationPanel} from '../generation/GenerationPanel';
import {Library} from './Library';
import {Viewport,type Mode} from './Viewport';
import {TransformPanel} from './TransformPanel';
import type {CameraCommand} from './camera';
import {useEditor} from './use-editor';
import {HistoryPanel} from './HistoryPanel';
import './editor.css';
export function Editor(){
  const editor=useEditor();const [mode,setMode]=useState<Mode>('translate'),[cameraRequest,setCameraRequest]=useState<{seq:number;command:CameraCommand}|null>(null);
  const localCamera=(command:CameraCommand)=>setCameraRequest(previous=>({seq:(previous?.seq??0)+1,command}));
  const focus=()=>{if(editor.selected)localCamera({op:'focus',id:editor.selected});else editor.setNotice('먼저 에셋을 선택해 주세요.');};
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.isComposing)return;
      if(event.target instanceof Element&&event.target.closest('dialog'))return;
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      if(event.target instanceof HTMLElement&&(event.target.isContentEditable||event.target instanceof HTMLSelectElement))return;
      if(event.ctrlKey||event.metaKey){if(event.key.toLowerCase()==='z'||event.key.toLowerCase()==='y'){event.preventDefault();void editor.send([{op:event.key.toLowerCase()==='y'||event.shiftKey?'redo':'undo'}]);}return;}
      if(event.key==='Delete'&&!event.altKey&&!event.shiftKey&&!event.repeat&&editor.selected){event.preventDefault();void editor.send([{op:'delete',id:editor.selected}]);return;}
      if(event.key.toLowerCase()==='w')setMode('translate');
      if(event.key.toLowerCase()==='e')setMode('rotate');
      if(event.key.toLowerCase()==='r')setMode('scale');
      if(event.key==='Escape')void editor.select(null);
      if(event.key.toLowerCase()==='f')focus();
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  });
  return <main className="studio">
    <header className="topbar"><div className="brand-mark">◈</div><div className="brand"><h1>AI 공간 꾸미기</h1><span>SPACE STUDIO</span></div><div className="top-separator"/><div className="project-name"><small>나의 첫 번째 공간</small><strong>우리의 작은 정원 <span>⌄</span></strong></div><div className="top-spacer"/><a className="preview-tag" href={editor.role==='teacher'?'/?teacher=1':'/?login=1'}>{editor.storage==='memory'?'수업 입장':editor.role==='teacher'?'강사 대시보드':'수업 변경'}</a>{editor.storage==='postgres'&&<a className="preview-tag" href={'/?vr='+encodeURIComponent(editor.snapshot.roomId)}>VR 감상</a>}<span className="connection"><i className={editor.status==='서버 연결됨'?'live-dot':''}/>{editor.status}</span><button className="help-button" title="왼쪽 에셋을 끌어 놓고 W/E/R로 조작하세요.">?</button><div className="avatar">나</div></header>
    <div className="workspace"><Library token={editor.chatTransport?.identity.token??''} roomId={editor.storage==='postgres'?editor.snapshot.roomId:undefined} actor={editor.actor} role={editor.role} library={editor.library} place={editor.place} objects={Object.values(editor.snapshot.objects)} select={editor.select} selected={editor.selected}/><section className="center">
      <div className="toolbar"><div className="mode-buttons">{([['translate','↔','이동','W'],['rotate','⟳','회전','E'],['scale','⤢','크기','R']] as const).map(([m,icon,name,key])=><button key={m} className={mode===m?'active':''} aria-label={name+' 모드'} aria-pressed={mode===m} onClick={()=>setMode(m)}><span>{icon}</span>{name}<kbd>{key}</kbd></button>)}</div><div className="tool-divider"/><button className="icon-button" aria-label="되돌리기" title="되돌리기 Ctrl+Z" onClick={()=>{void editor.send([{op:'undo'}]);}}>↶</button><button className="icon-button" aria-label="다시하기" title="다시하기 Ctrl+Y" onClick={()=>{void editor.send([{op:'redo'}]);}}>↷</button><div className="top-spacer"/><button className="icon-button" aria-label="확대" onClick={()=>localCamera({op:'zoom',factor:.8})}>＋</button><button className="icon-button" aria-label="축소" onClick={()=>localCamera({op:'zoom',factor:1.25})}>−</button><button className="icon-button" aria-label="카메라 궤도 회전" onClick={()=>localCamera({op:'orbit',azimuth:Math.PI/12,polar:0})}>⤿</button><button className="focus-button"  onClick={()=>focus()}>⌖ <span>선택 보기</span><kbd>F</kbd></button></div>
      <Viewport editor={editor} mode={mode} cameraRequest={cameraRequest}/>
      <div className="scene-footer"><span><i className="live-dot"/> 편집 모드</span><span aria-label="에셋 수">{Object.keys(editor.snapshot.objects).length} / 200</span><span className="top-spacer"/><span>{editor.storage==='postgres'?'자동 저장 사용':'체험 모드 · 종료 시 초기화'}</span></div>
      {editor.notice&&<div className="notice" role="status" aria-label="작업 안내">{editor.notice}<button aria-label="안내 닫기" onClick={()=>editor.setNotice('')}>×</button></div>}
    </section><aside className="right-panel panel">{editor.role==='teacher'&&<HistoryPanel editor={editor}/>}<TransformPanel editor={editor}/><GenerationPanel editor={editor}/><ChatPanel capacityMessage={roomCapacityMessage(Object.keys(editor.snapshot.objects).length)} undo={expectedSeq=>editor.send([{op:'undo',expectedSeq}])} cameraCenter={editor.cameraCenter} transport={editor.chatTransport} selected={editor.selected} connected={editor.status==='서버 연결됨'}/></aside></div>
  </main>;
}
