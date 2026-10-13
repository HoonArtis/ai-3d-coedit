export function resolveServerEndpoint(configured:string|undefined,development:boolean,origin:string){
 return (configured||(development?'http://127.0.0.1:2567':origin)).replace(/\/$/,'');
}
export const serverEndpoint=resolveServerEndpoint(import.meta.env.VITE_SERVER_URL,import.meta.env.DEV,globalThis.location?.origin??'http://127.0.0.1:2567');
