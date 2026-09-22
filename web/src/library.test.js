import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createAsset,catalog} from "./models.js";
import {planLayout,intersects} from "./layout.js";
import {skyColor,createMoon,positionMoon,faceMoon} from "./sky.js";
import {routePath,planPaths} from "./paths.js";
import {terrainSampler,createLandscape,objectElevation,refreshPaths} from "./landscape.js";
import {createMetropolis} from "./city.js";
import {createLargeWorld} from "./worlds.js";
import {findPlayerSpawn as findLargeWorldSpawn,collidesWithScene as collidesInLargeWorld} from "./explore.js";
import {musicPlanForSpec} from "./music.js";

const colors={fabric:0xd7b982,wood:0x6d4930,leaf:0x315f42,accent:0xffa84c,stone:0x737772};
function rng(seed=42){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test("hierarchical city plans expand into large navigable worlds",()=>{
  for(const [archetype,density,roads,skyline] of [
    ["atlantic","dense","tight_grid","single_core"],
    ["coastal_tech","megacity","superblocks","twin_core"],
    ["sunbelt","urban","avenue_grid","distributed"],
  ]){
    const city=createMetropolis({city:{archetype,density,roads,skyline,districts:"polycentric",topology:"orthogonal_core",greenNetwork:"central_anchor",waterfront:"harbor",civicSpace:"central_park",traffic:"busy",landmark:"spire"}},rng(7));
    assert.ok(city.stats.buildings>30,`${archetype} building count`);
    assert.ok(city.stats.blocks>=10,`${archetype} district blocks`);
    assert.ok(city.stats.roads>=6,`${archetype} road network`);
    assert.ok(Object.values(city.stats.districts).filter(Boolean).length>=3,`${archetype} needs several districts`);
    assert.equal(city.layout.items.length,city.stats.buildings+1);
    assert.ok(city.layout.landRadius>45,"city must be much larger than a diorama");
    assert.equal(city.landscape.heightAt(10,10),.18);
    const bounds=new THREE.Box3().setFromObject(city.group);
    assert.ok(bounds.getSize(new THREE.Vector3()).x>60);
    city.group.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
  }
});
test("the same city brief produces visibly different macro plans across variants",()=>{
  const spec={city:{archetype:"coastal_tech",density:"megacity",roads:"superblocks",skyline:"twin_core",districts:"polycentric",
    topology:"diagonal_axes",greenNetwork:"linked_nodes",waterfront:"harbor",civicSpace:"promenade",traffic:"busy",landmark:"terraced"}};
  const first=createMetropolis(spec,rng(11)),second=createMetropolis(spec,rng(987654321));
  assert.equal(first.stats.macro.topology,"diagonal_axes");
  assert.equal(first.stats.macro.civicCenters.length,3);
  assert.notDeepEqual(first.stats.macro,second.stats.macro,"variant must alter coast, axes, civic nodes or landmark placement");
  assert.notDeepEqual(first.stats.macro.landmark,second.stats.macro.landmark,"landmark must move between variants");
  const firstPositions=first.layout.items.slice(0,20).map(({x,z,height})=>[x,z,+height.toFixed(2)]);
  const secondPositions=second.layout.items.slice(0,20).map(({x,z,height})=>[x,z,+height.toFixed(2)]);
  assert.notDeepEqual(firstPositions,secondPositions,"district geometry must visibly change");
  for(const city of [first,second])city.group.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
});
test("large scene families expand semantic plans into distinct randomized worlds",()=>{
  const cases=[
    {scenePack:"ocean_liner",world:{archetype:"classic_liner",topology:"ice_field",density:"grand",population:"passenger_day",feature:"promenade",hazard:"iceberg",landmark:"four_funnels"}},
    {scenePack:"prehistoric",world:{archetype:"jungle_reserve",topology:"river_corridor",density:"lush",population:"mixed_ecosystem",feature:"park_gate",hazard:"calm",landmark:"mountain_ring"}},
    {scenePack:"medieval_city",world:{archetype:"northern_keep",topology:"walled_hill",density:"thriving",population:"daily_life",feature:"market_square",hazard:"peaceful",landmark:"high_keep"}},
  ];
  for(const spec of cases){
    const first=createLargeWorld(spec,rng(4)),second=createLargeWorld(spec,rng(9));
    assert.equal(first.stats.family,spec.scenePack);
    assert.equal(first.layout.largeWorld,true);
    assert.ok(first.layout.sceneExtent>=76);
    assert.ok(first.layout.avatarScale<1);
    assert.ok(first.layout.items.length>4);
    const spawn=findLargeWorldSpawn(first.layout,first.landscape.heightAt,.34*first.layout.avatarScale);
    assert.equal(collidesInLargeWorld(spawn.x,spawn.z,first.layout.items,.34*first.layout.avatarScale),false);
    assert.ok(Math.hypot(spawn.x,spawn.z)<first.layout.landRadius);
    if(spec.scenePack==="ocean_liner"){
      assert.equal(spawn.y,5.9);
      assert.ok(Math.abs(spawn.z)<8.2,"liner spawn must stay on the passenger deck");
    }
    const bounds=new THREE.Box3().setFromObject(first.group),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.x>70&&size.z>30,`${spec.scenePack} must occupy a large world`);
    const signature=world=>world.layout.items.map(entry=>[entry.x,entry.z,entry.width,entry.depth,entry.model.rotation.y]).flat().join(",");
    assert.notEqual(signature(first),signature(second),`${spec.scenePack} should vary with the generation seed`);
    for(const world of [first,second])world.group.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
  }
});
test("scene music is deterministic per variant and changes across world families",()=>{
  const ocean=musicPlanForSpec({scenePack:"ocean_liner",variant:42,world:{archetype:"classic_liner"}});
  const oceanAgain=musicPlanForSpec({scenePack:"ocean_liner",variant:42,world:{archetype:"classic_liner"}});
  const medieval=musicPlanForSpec({scenePack:"medieval_city",variant:42,world:{archetype:"royal_capital"}});
  assert.deepEqual(ocean,oceanAgain);
  assert.equal(ocean.profile,"ocean");
  assert.equal(ocean.beats,3);
  assert.equal(medieval.profile,"medieval");
  assert.notDeepEqual(ocean.melody,medieval.melody);
  for(const plan of [ocean,medieval,musicPlanForSpec({environment:"forest",variant:7})]){
    assert.ok(plan.bpm>=60&&plan.bpm<=100);
    assert.ok(plan.volume>0&&plan.volume<.2);
    assert.equal(plan.melody.length,plan.beats*4);
  }
});
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
      assert.ok(Math.abs(item.z-result.roadZ)>=item.depth/2+1.8,item.type+" occupies the road");
    const train=result.items.find(i=>i.type==="train");
    assert.ok(Math.abs(train.z-result.roadZ)>2,"railway must not run on the road");
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

test("camp furniture faces a shared fire and trees leave the foreground open",()=>{
  for(let seed=1;seed<=8;seed++){
    const input=prepared([["tent",3],["campfire",1],["chair",3],["pine",5],["picnic_table",1],["pond",1]]);
    input.filter(i=>i.type==="chair").forEach(i=>{i.placement="around";});
    const result=planLayout(input,{environment:"forest"},rng(seed));
    const fire=result.items.find(i=>i.type==="campfire");
    assert.equal(result.items.length,input.length);
    for(const item of result.items.filter(i=>["tent","chair"].includes(i.type))){
      assert.ok(Math.abs(item.facing-Math.atan2(fire.x-item.x,fire.z-item.z))<1e-8);
      assert.ok(Math.hypot(fire.x-item.x,fire.z-item.z)<10,item.type+" too far from fire");
    }
    for(const item of result.items.filter(i=>i.type==="pine"))assert.ok(item.z<1,"tree blocks foreground");
    for(let i=0;i<result.items.length;i++)for(let j=i+1;j<result.items.length;j++)
      assert.ok(!intersects(result.items[i],result.items[j],0),"camp overlap");
    assert.ok(planPaths(result).length>=2,"camp should have connected paths");
  }
});

test("paths route around water and buildings instead of crossing them",()=>{
  const obstacles=[{x:0,z:0,width:4,depth:4}];
  const path=routePath({x:-5,z:0},{x:5,z:0},obstacles,12);
  assert.ok(path.length>10);
  for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.1){
    const x=path[i-1].x*(1-t)+path[i].x*t,z=path[i-1].z*(1-t)+path[i].z*t;
    assert.ok(Math.abs(x)>=2.3||Math.abs(z)>=2.3,"path clips an obstacle");
  }
});

test("landscape keeps the build area level, slopes in the distance and honors exact inventories",()=>{
  const layout=planLayout(prepared([["tree",5],["tent",2]]),{environment:"forest"},rng());
  const height=terrainSampler({environment:"forest"},layout);
  for(const item of layout.items)assert.equal(height(item.x,item.z),-.035);
  assert.ok(height(layout.landRadius+60,0)>2);
  const landscape=createLandscape({environment:"forest",scenery:false},layout,0x354f35,rng());
  assert.equal(landscape.group.getObjectByName("background-canopies"),undefined);
  const coastal=terrainSampler({environment:"coast"},layout);
  assert.ok(coastal(layout.landRadius+3,0)<-.42,"sea must cover terrain beyond shore");
  assert.equal(objectElevation({type:"boat",x:layout.landRadius+4,z:0},{environment:"coast"},coastal),-.42,"boats float at sea level, not on the sea bed");
  landscape.group.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
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


test("manual moves preserve asset scale and orientation, track terrain and keep boats afloat", async()=>{
  const {moveItem}=await import("./editing.js");
  const model=createAsset("tent",colors,rng());
  model.scale.setScalar(1.2);model.rotation.y=.8;
  const item={type:"tent",model,x:0,z:0,pool:new THREE.Object3D()};
  const heightAt=(x,z)=>x*.1+z*.2;
  moveItem(item,8,-3,{environment:"meadow"},heightAt);
  assert.deepEqual([item.x,item.z],[8,-3]);
  assert.deepEqual(model.position.toArray(),[8,heightAt(8,-3)+.008,-3]);
  assert.equal(model.scale.x,1.2);assert.equal(model.rotation.y,.8);
  assert.deepEqual([item.pool.position.x,item.pool.position.z],[8,-3]);
  moveItem({...item,type:"boat"},20,5,{environment:"ocean"},heightAt);
  assert.equal(model.position.y,-.42);
});

test("editing reroutes paths without replacing terrain or accumulating path meshes",()=>{
  const items=[{type:"tent",group:"camp",x:-4,z:0,width:2,depth:2},
    {type:"tent",group:"camp",x:4,z:0,width:2,depth:2}];
  const layout={items,landRadius:12};
  const spec={environment:"meadow",terrain:"rolling"};
  const land=createLandscape(spec,layout,0x354f35,rng());
  const ground=land.group.children[0],before=JSON.stringify(land.paths),oldPaths=land.pathGroup;
  items[1].z=8;
  refreshPaths(land,layout,spec);
  assert.notEqual(JSON.stringify(land.paths),before);
  assert.equal(land.group.children[0],ground);
  assert.equal(oldPaths.parent,null);
  refreshPaths(land,layout,spec);
  assert.equal(land.group.children.filter(c=>c.name==="walking-paths").length,1);
});

test("scaling and rotation keep the grounded pivot and update collision footprints",async()=>{
  const {transformItem}=await import("./editing.js");
  const model=new THREE.Mesh(new THREE.BoxGeometry(2,2,6).translate(0,1,0),new THREE.MeshBasicMaterial());
  const item={model,type:"house",x:7,z:-2,original:{scale:model.scale.clone(),rotation:0}};
  transformItem(item,2,Math.PI/2,{environment:"meadow"},()=>.7);
  assert.ok(Math.abs(item.width-12)<1e-8);
  assert.ok(Math.abs(item.depth-4)<1e-8);
  assert.equal(item.height,4);
  assert.deepEqual(model.position.toArray(),[7,.708,-2]);
  transformItem(item,1,0,{environment:"meadow"},()=>.7);
  assert.equal(item.width,2);assert.equal(item.depth,6);assert.equal(model.scale.x,1);
});

test("append packing respects moved and resized anchors without changing old objects",async()=>{
  const {appendLayout}=await import("./layout.js");
  const current={landRadius:30,items:[{type:"pond",x:12,z:3,width:10,depth:8},
    {type:"tent",x:3,z:9,width:7,depth:5,rotation:1.5,scale:2}]};
  const before=JSON.stringify(current);
  const added=appendLayout(Array.from({length:4},(_,index)=>({type:"cherry",group:"flora",anchor:"pond",placement:"right",index,count:4,width:3,depth:3,height:5})),current,{environment:"meadow"},rng());
  assert.equal(JSON.stringify(current),before);
  assert.equal(added.length,4);
  for(let i=0;i<added.length;i++) {
    assert.ok(added[i].x>12);
    assert.ok(![...current.items,...added.slice(0,i)].some(o=>intersects(added[i],o,.29)));
  }
  assert.throws(()=>appendLayout([{type:"house",width:100,depth:100,index:0,count:1}],{items:[],landRadius:5},{environment:"coast"},rng()),/No clear space/);
});
test("ocean-liner additions place people aboard and boats beside the hull",async()=>{
  const {appendLayout}=await import("./layout.js");
  const current={largeWorld:true,worldFamily:"ocean_liner",landRadius:54,items:[
    {type:"liner_superstructure",x:-4,z:0,width:64,depth:12,height:6},
    {type:"deck_rail",x:0,z:-8.2,width:106,depth:.35,height:1},
    {type:"deck_rail",x:0,z:8.2,width:106,depth:.35,height:1},
  ]};
  const person={type:"person",group:"people",anchor:"scene",placement:"auto",index:0,count:2,width:.7,depth:.7,height:1.8};
  const boat={type:"boat",group:"vehicle",anchor:"scene",placement:"auto",index:0,count:2,width:3,depth:1.5,height:1};
  const [addedPerson]=appendLayout([person],current,{environment:"ocean"},rng(9));
  const [addedBoat]=appendLayout([boat],{...current,items:[...current.items,addedPerson]},{environment:"ocean"},rng(9));
  assert.ok(Math.abs(addedPerson.x)<54&&Math.abs(addedPerson.z)<8,"person should stand on the liner deck");
  assert.ok(Math.abs(addedBoat.x)<45&&Math.abs(addedBoat.z)>10,"boat should float beside the hull");
});

test("floating toolbar stays near the object and within desktop and phone viewports",async()=>{
  const {toolbarPosition}=await import("./editing.js");
  const size={width:290,height:118};
  const above=toolbarPosition({left:550,right:650,top:370,bottom:500},{width:1440,height:700},size);
  assert.equal(above.x,455);
  assert.equal(above.y,238);
  for (const viewport of [{width:390,height:472},{width:1440,height:700}]) {
    for (const bounds of [
      {left:-200,right:20,top:0,bottom:60},
      {left:viewport.width-20,right:viewport.width+100,top:20,bottom:200},
      {left:10,right:300,top:440,bottom:650},
    ]) {
      const pos=toolbarPosition(bounds,viewport,size);
      assert.ok(pos.x>=12 && pos.x+size.width<=viewport.width-12);
      assert.ok(pos.y>=Math.min(112,viewport.height*.24));
      assert.ok(pos.y+size.height<=viewport.height-48);
    }
  }
});

test("first-person spawn finds open ground and scene collision respects solid groups",async()=>{
  const {findPlayerSpawn,collidesWithScene,normalizeControlCode,createPlayerAvatar,nextExploreView,resolveAvatarStyle,applyAvatarStyle,isExploreCheckpointUsable,avatarScaleForLayout}=await import("./explore.js");
  const items=[
    {type:"tent",group:"camp",x:0,z:3,width:5,depth:5},
    {type:"tree",group:"flora",x:4,z:2,width:2,depth:2},
    {type:"person",group:"people",x:-4,z:2,width:1,depth:1},
  ];
  const spawn=findPlayerSpawn({items,landRadius:14},(x,z)=>x*.01+z*.02);
  assert.ok(Math.hypot(spawn.x,spawn.z)<14*.85);
  assert.equal(collidesWithScene(spawn.x,spawn.z,items,.52),false);
  assert.equal(spawn.y,spawn.x*.01+spawn.z*.02);
  assert.equal(collidesWithScene(0,3,items),true);
  assert.equal(collidesWithScene(-4,2,items),false,"people should not create invisible walls");
  assert.equal(isExploreCheckpointUsable({x:-4,z:5,yaw:1,pitch:.1},{layout:{items,landRadius:14}}),true);
  assert.equal(isExploreCheckpointUsable({x:0,z:3,yaw:1,pitch:.1},{layout:{items,landRadius:14}}),false);
  assert.equal(isExploreCheckpointUsable({x:30,z:3,yaw:1,pitch:.1},{layout:{items,landRadius:14}}),false);
  assert.equal(normalizeControlCode({code:"ArrowUp"}),"KeyW");
  assert.equal(normalizeControlCode({code:"ArrowLeft"}),"KeyA");
  assert.equal(normalizeControlCode({key:"ArrowDown"}),"KeyS");
  assert.equal(normalizeControlCode({key:"ArrowRight"}),"KeyD");
  assert.deepEqual([nextExploreView("third"),nextExploreView("first"),nextExploreView("overview")],["first","overview","third"]);
  const avatar=createPlayerAvatar();
  assert.equal(avatar.name,"explorer-avatar");
  assert.ok(avatar.userData.rig.leftLeg.userData.joint);
  assert.ok(avatar.userData.rig.rightArm.userData.joint);
  assert.equal(avatar.getObjectsByProperty("name","avatar-eye").length,2);
  assert.equal(avatar.getObjectsByProperty("name","avatar-pupil").length,2);
  assert.equal(avatar.getObjectsByProperty("name","avatar-nose").length,1);
  assert.equal(avatar.getObjectsByProperty("name","avatar-mouth").length,1);
  assert.equal(avatarScaleForLayout({}),1);
  assert.equal(avatarScaleForLayout({avatarScale:.68}),.68);
  assert.equal(avatarScaleForLayout({avatarScale:.1}),.45);
  avatar.scale.setScalar(avatarScaleForLayout({avatarScale:.68}));
  const cityAvatarHeight=new THREE.Box3().setFromObject(avatar).getSize(new THREE.Vector3()).y;
  assert.ok(cityAvatarHeight>1.3&&cityAvatarHeight<1.6,"city avatar should read as pedestrian scale");
  const style=applyAvatarStyle(avatar,{variant:9,palette:"winter",avatar:{jacket:"violet",trousers:"ice",accessory:"scarf",accessoryColor:"cream"}});
  assert.deepEqual({jacket:style.jacket,trousers:style.trousers,accessory:style.accessory,accessoryColor:style.accessoryColor},
    {jacket:"violet",trousers:"ice",accessory:"scarf",accessoryColor:"cream"});
  assert.equal(avatar.userData.outfit.accessories.scarf.visible,true);
  assert.equal(avatar.userData.outfit.accessories.backpack.visible,false);
  const fallback=resolveAvatarStyle({variant:2,palette:"desert"});
  assert.equal(fallback.jacket,"sand");
  assert.ok(["none","backpack","scarf","cap","satchel"].includes(fallback.accessory));
});
