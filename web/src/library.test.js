import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createAsset,catalog} from "./models.js";
import {planLayout,intersects} from "./layout.js";
import {skyColor,createMoon,positionMoon,faceMoon} from "./sky.js";

const colors={fabric:0xd7b982,wood:0x6d4930,leaf:0x315f42,accent:0xffa84c,stone:0x737772};
function rng(seed=42){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test("every catalog asset builds nonempty finite geometry at its documented scale",()=>{
  assert.ok(catalog.length>=100);
  assert.equal(new Set(catalog.map(a=>a.type)).size,catalog.length);
  for(const entry of catalog){
    const model=createAsset(entry.type,colors,rng());
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(!bounds.isEmpty(),entry.type);
    assert.ok([size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0),entry.type);
    assert.ok(size.y>entry.height*.85&&size.y<entry.height*1.15,entry.type+" height");
    assert.ok(Math.abs(bounds.min.y)<.01,entry.type+" must stand on ground");
    let triangles=0;
    model.traverse(node=>{
      if(node.geometry){
        const array=node.geometry.attributes.position.array;
        assert.ok(array.every(Number.isFinite),entry.type+" nonfinite vertex");
        triangles+=(node.geometry.index?.count??array.length/3)/3;
        node.geometry.dispose();
      }
      if(node.material)node.material.dispose();
    });
    assert.ok(triangles>=8,entry.type+" has no renderable solid geometry");
  }
});
function prepared(types){
  return types.flatMap(([type,count])=>{
    const def=catalog.find(a=>a.type===type);
    return Array.from({length:count},(_,index)=>{
      const model=createAsset(type,colors,rng(index+1));
      const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      return{type,group:def.group,index,count,placement:"auto",width:size.x,depth:size.z,height:size.y};
    });
  });
}
test("mixed-scale city preserves every object and packs nonoverlapping footprints",()=>{
  const input=prepared([["building",8],["train",1],["station",1],["bicycle",5],["man",10],["tree",5],["bench",4]]);
  for(let seed=1;seed<=8;seed++){
    const result=planLayout(input,{environment:"city"},rng(seed));
    assert.equal(result.items.length,input.length);
    for(const item of result.items.filter(a=>a.group!=="vehicle"))
      assert.ok(Math.abs(item.z-1)>=item.depth/2+1.4,item.type+" occupies the road");
    for(let i=0;i<result.items.length;i++)for(let j=i+1;j<result.items.length;j++)
      assert.ok(!intersects(result.items[i],result.items[j],0),result.items[i].type+" overlaps "+result.items[j].type);
  }
});
test("boats remain outside final land shoreline",()=>{
  const result=planLayout(prepared([["lighthouse",3],["palm",10],["boat",5]]),{environment:"ocean"},rng());
  for(const item of result.items.filter(a=>a.type==="boat"))
    assert.ok(Math.hypot(item.x,item.z)>result.landRadius+Math.hypot(item.width,item.depth)/2);
});

test("night sky remains dark across ground biomes",()=>{
  for(const environment of ["meadow","garden","forest","snow","ocean","city"]){
    const night=new THREE.Color(skyColor({environment,lighting:"night"}));
    const day=new THREE.Color(skyColor({environment,lighting:"day"}));
    assert.ok(night.r+night.g+night.b < (day.r+day.g+day.b)*.1,environment);
    assert.ok(night.b>night.g && day.b>day.g,environment+" sky must not inherit green ground");
  }
});

test("moon stays at a fixed sky position and scale while the camera orbits and resizes",()=>{
  assert.equal(createMoon("none"),null);
  assert.equal(createMoon(undefined),null);
  for(const phase of ["full","crescent"]){
    const moon=createMoon(phase);
    assert.ok(moon.children.some(child=>child.geometry.attributes.position.count>20));
    positionMoon(moon,12,6);
    const fixedPosition=moon.position.clone(),fixedScale=moon.scale.clone();
    assert.ok(fixedPosition.y>6+fixedScale.y*1.4,"moon must clear the tallest ground asset");
    const projections=[];
    for(const [aspect,angle,distance] of [[.5,0,30],[1,.6,40],[2,1.5,60]]){
      const camera=new THREE.PerspectiveCamera(42,aspect,.1,160);
      camera.position.set(Math.sin(angle)*distance,12,Math.cos(angle)*distance);
      camera.lookAt(0,0,0);camera.updateMatrixWorld();
      faceMoon(moon,camera);
      assert.ok(moon.position.equals(fixedPosition));
      assert.ok(moon.scale.equals(fixedScale));
      assert.ok(moon.quaternion.equals(camera.quaternion));
      const screen=moon.position.clone().project(camera);
      projections.push(screen);
    }
    assert.ok(projections[0].distanceTo(projections[1])>.1,"moon must not remain pinned to screen coordinates");
  }
});
