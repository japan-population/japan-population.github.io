export type MapViewport={x:number;y:number;zoom:number};
export type MapDimensions={width:number;height:number};
const municipalDimensions:MapDimensions={width:800,height:480};
export function clampMapViewport(v:MapViewport,{width,height}:MapDimensions=municipalDimensions):MapViewport{
 const zoom=Math.max(1,Math.min(256,v.zoom));
 return {zoom,x:Math.max(0,Math.min(width-width/zoom,v.x)),y:Math.max(0,Math.min(height-height/zoom,v.y))};
}
export function zoomMapViewport(v:MapViewport,zoom:number,dimensions:MapDimensions=municipalDimensions):MapViewport{
 const {width,height}=dimensions;
 zoom=Math.max(1,Math.min(256,zoom));
 return clampMapViewport({zoom,x:v.x+width/2/v.zoom-width/2/zoom,y:v.y+height/2/v.zoom-height/2/zoom},dimensions);
}

// Approximate ground distance for the locally projected map. Pick a readable 1/2/5 tick.
export function mapScale(kilometersPerUnit:number,zoom:number){
 const target=kilometersPerUnit*160/zoom;
 const power=10**Math.floor(Math.log10(target));
 const km=[5,2,1].map(n=>n*power).find(n=>n<=target)??power;
 return {widthPercent:km/(kilometersPerUnit*800/zoom)*100,label:km<1?`${Math.round(km*1000)} m`:`${Number(km.toPrecision(3))} km`};
}
