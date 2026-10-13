import {startRuntime} from './runtime';
const server=await startRuntime(process.env.LOCAL_PREVIEW==='1');
console.log('Coedit server: '+server.url);
let closing=false;
const close=()=>{if(closing)return;closing=true;void server.close().then(()=>process.exit(0));};
process.on('SIGINT',close);process.on('SIGTERM',close);
