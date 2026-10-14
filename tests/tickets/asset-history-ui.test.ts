import {test,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Library} from '../../apps/web/src/editor/Library';
import {BUILTIN_LIBRARY} from '@coedit/contracts';

test('library exposes asset History and explains immediate availability without teacher approval',()=>{
 const html=renderToStaticMarkup(createElement(Library,{library:{},place:async()=>{},objects:[],select:async()=>{},selected:null}));
 expect(html).toContain('History');
 expect(html).not.toContain('승인');
});

test('private peer assets stay out of the placement library but are available to their creator and teacher',()=>{
 const library={private:{...BUILTIN_LIBRARY.chair,id:'private',name:'Private bench',creator:'alice',shared:false},public:{...BUILTIN_LIBRARY.chair,id:'public',name:'Public bench',creator:'alice',shared:true}};
 const render=(actor:string,role:'student'|'teacher')=>renderToStaticMarkup(createElement(Library,{library,actor,role,place:async()=>{},objects:[],select:async()=>{},selected:null}));
 expect(render('bob','student')).not.toContain('Private bench');
 expect(render('bob','student')).toContain('Public bench');
 expect(render('alice','student')).toContain('Private bench');
 expect(render('teacher','teacher')).toContain('Private bench');
});
