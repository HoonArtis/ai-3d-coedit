/** Shares the in-flight promise, including with shutdown/drain callers. */
export function singleFlight(work:()=>Promise<void>){let pending:Promise<void>|undefined;return ()=>pending??=(async()=>{try{await work();}finally{pending=undefined;}})();}
