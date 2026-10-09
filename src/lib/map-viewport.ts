export type MapViewport={x:number;y:number;zoom:number};
export function clampMapViewport(v:MapViewport):MapViewport{
 const zoom=Math.max(1,Math.min(256,v.zoom));
 return {zoom,x:Math.max(0,Math.min(800-800/zoom,v.x)),y:Math.max(0,Math.min(480-480/zoom,v.y))};
}
export function zoomMapViewport(v:MapViewport,zoom:number):MapViewport{
 zoom=Math.max(1,Math.min(256,zoom));
 return clampMapViewport({zoom,x:v.x+400/v.zoom-400/zoom,y:v.y+240/v.zoom-240/zoom});
}

// Approximate ground distance for the locally projected map. Pick a readable 1/2/5 tick.
export function mapScale(kilometersPerUnit:number,zoom:number){
 const target=kilometersPerUnit*160/zoom;
 const power=10**Math.floor(Math.log10(target));
 const km=[5,2,1].map(n=>n*power).find(n=>n<=target)??power;
 return {widthPercent:km/(kilometersPerUnit*800/zoom)*100,label:km<1?`${Math.round(km*1000)} m`:`${Number(km.toPrecision(3))} km`};
}
