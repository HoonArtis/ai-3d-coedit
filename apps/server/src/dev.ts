import {startRuntime} from './runtime';
const server=await startRuntime(true);
console.log('Local preview server: '+server.url);
process.once('SIGINT',()=>{void server.close().then(()=>process.exit(0));});
