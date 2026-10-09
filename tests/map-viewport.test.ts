import {expect,it} from 'vitest';
import {clampMapViewport,zoomMapViewport,mapScale} from '../src/lib/map-viewport';
it('初期表示と縮小後は地図全体の範囲に戻る',()=>{
 expect(clampMapViewport({x:200,y:100,zoom:1})).toEqual({x:0,y:0,zoom:1});
 expect(zoomMapViewport({x:550,y:300,zoom:4},1)).toEqual({x:0,y:0,zoom:1});
});
it('中心を保って拡大し、ドラッグで地図の外へ抜けない',()=>{
 expect(zoomMapViewport({x:0,y:0,zoom:1},2)).toEqual({x:200,y:120,zoom:2});
 expect(clampMapViewport({x:1000,y:1000,zoom:2})).toEqual({x:400,y:240,zoom:2});
 expect(clampMapViewport({x:-100,y:-100,zoom:2})).toEqual({x:0,y:0,zoom:2});
});
it('連続した拡大縮小でも倍率の範囲を保つ',()=>{
 expect(zoomMapViewport({x:0,y:0,zoom:1},0)).toEqual({x:0,y:0,zoom:1});
 expect(zoomMapViewport({x:300,y:180,zoom:256},512)).toEqual({x:300,y:180,zoom:256});
});

it('縮尺は倍率に追従し、km未満はmで表示する',()=>{
 expect(mapScale(1,1)).toEqual({widthPercent:12.5,label:'100 km'});
 expect(mapScale(1,2)).toEqual({widthPercent:12.5,label:'50 km'});
 expect(mapScale(.01,4)).toEqual({widthPercent:10,label:'200 m'});
});
