/** Local display only: the same actor is recognizable from every observer. */
export function actorColor(actor:string){
 let hash=2166136261;for(const char of actor)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 return `hsl(${(hash%3600)/10}, 70%, 43%)`;
}
