import express,{type Application} from 'express';
import {resolve} from 'node:path';
export function mountWebSurface(app:Application,root:string){
 // Only the built output is public. Unknown API routes must remain 404.
 app.use(express.static(resolve(root),{dotfiles:'deny',index:'index.html'}));
}
