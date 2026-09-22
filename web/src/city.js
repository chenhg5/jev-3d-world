import * as THREE from "three";

const cityPalettes = {
  atlantic: {ground:0x777b7d, road:0x252a2e, walk:0xa6a19a, park:0x496b47,
    buildings:[0x6e7479,0x8a8178,0x57636c,0x9a9388,0x4c5962], glass:0x7aa1ae, accent:0xd7c07a},
  coastal_tech: {ground:0x7b8584, road:0x293238, walk:0xb7b9b3, park:0x4c7655,
    buildings:[0x9aa6aa,0x617b85,0x768e95,0xc0c5c1,0x526a75], glass:0x70b4c4, accent:0x6ee3ce},
  sunbelt: {ground:0x9a8f7b, road:0x34363a, walk:0xc8bba3, park:0x65784b,
    buildings:[0xb58f72,0x8b9a9b,0xd0b99b,0x756f70,0x9e7b68], glass:0x75a9b8, accent:0xf2b36c},
  global: {ground:0x7a8082, road:0x292e33, walk:0xb2b0aa, park:0x527251,
    buildings:[0x7e898e,0x9c9690,0x68767f,0xb1b3b0,0x59656b], glass:0x78a4b2, accent:0xb8e97c},
};

const densitySettings = {
  urban: {extent:72, lots:2, traffic:24, height:.72},
  dense: {extent:92, lots:3, traffic:46, height:1},
  megacity: {extent:116, lots:3, traffic:76, height:1.22},
};

const roadSettings = {
  tight_grid: {block:10, road:2.6},
  avenue_grid: {block:14, road:3.8},
  superblocks: {block:20, road:5.2},
  mixed: {block:15.5, road:3.6},
};

function mat(color, options={}) {
  return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.04,...options});
}

function box(width,height,depth,material) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
  mesh.position.y=height/2;
  mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}

function skylineStrength(kind,x,z,extent) {
  const gaussian=(cx,cz,r)=>Math.exp(-(Math.hypot(x-cx,z-cz)**2)/(r*r));
  if(kind==="twin_core") return Math.max(gaussian(-extent*.2,0,extent*.22),gaussian(extent*.2,-extent*.1,extent*.2));
  if(kind==="linear") return Math.exp(-Math.abs(z+extent*.04)/(extent*.16))*(.7+.3*Math.exp(-Math.abs(x)/(extent*.6)));
  if(kind==="distributed") return Math.max(gaussian(0,0,extent*.2),gaussian(extent*.28,extent*.24,extent*.16),gaussian(-extent*.3,-extent*.22,extent*.17));
  return gaussian(0,0,extent*.28);
}

function districtFor(pattern,x,z,extent,strength) {
  const edge=Math.hypot(x,z)/Math.max(1,extent*.7);
  if(pattern==="polycentric") return strength>.58?"business":strength>.25?"mixed":((x+z)>0?"residential":"innovation");
  if(pattern==="waterfront_axis") return z<0?"waterfront":strength>.42?"business":"residential";
  if(pattern==="mixed_quarters") return ["mixed","residential","entertainment","business"][Math.abs((Math.floor(x/12)*3+Math.floor(z/12)))%4];
  return strength>.52?"business":edge<.72?"mixed":"residential";
}

function makeBuilding({x,z,width,depth,height,style,palette,random,index}) {
  const group=new THREE.Group();
  group.name=`city-building-${index}`;
  const color=palette.buildings[Math.floor(random()*palette.buildings.length)];
  const bodyMaterial=mat(color,{roughness:style==="coastal_tech"?.48:.75,metalness:style==="coastal_tech"?.18:.05});
  const glassMaterial=mat(palette.glass,{roughness:.25,metalness:.24,emissive:palette.glass,emissiveIntensity:.035});
  const podiumHeight=Math.min(3.2,height*.18);
  group.add(box(width,podiumHeight,depth,mat(new THREE.Color(color).multiplyScalar(.78))));
  const towerHeight=Math.max(.5,height-podiumHeight);
  const slender=height>28?.72:.9;
  const tower=box(width*slender,towerHeight,depth*slender,bodyMaterial);
  tower.position.y=podiumHeight+towerHeight/2;group.add(tower);
  // Alternating glazed facade bands make towers read at city scale without
  // producing thousands of individual window meshes.
  const bands=Math.min(11,Math.max(2,Math.floor(height/5)));
  for(let band=1;band<bands;band++){
    const y=podiumHeight+(towerHeight*band/bands);
    const front=new THREE.Mesh(new THREE.BoxGeometry(width*slender*.84,.22,.035),glassMaterial);
    front.position.set(0,y,-depth*slender/2-.02);group.add(front);
    const side=new THREE.Mesh(new THREE.BoxGeometry(.035,.22,depth*slender*.84),glassMaterial);
    side.position.set(width*slender/2+.02,y,0);group.add(side);
  }
  if(height>25){
    const crownHeight=Math.min(7,height*.12);
    const crown=box(width*slender*.7,crownHeight,depth*slender*.7,glassMaterial);
    crown.position.y=height+crownHeight/2;group.add(crown);
  } else {
    const roof=box(width*.28,.55,depth*.3,mat(0x454b4e));roof.position.y=height+.275;group.add(roof);
  }
  group.position.set(x,0,z);
  return group;
}

function makeLandmark(kind,palette,x,z,height=72) {
  const group=new THREE.Group();group.name="city-landmark";
  const stone=mat(palette.buildings[1],{roughness:.42,metalness:.12});
  const glass=mat(palette.glass,{roughness:.2,metalness:.28,emissive:palette.glass,emissiveIntensity:.06});
  const addTower=(offset=0,scale=1)=>{
    const base=box(6*scale,height*.72*scale,6*scale,glass);base.position.x=offset;group.add(base);
    const crown=box(4.4*scale,height*.18*scale,4.4*scale,stone);crown.position.set(offset,height*.72*scale+height*.09*scale,0);group.add(crown);
    return height*.9*scale;
  };
  if(kind==="twin_towers") {addTower(-4, .88);addTower(4,1);}
  else if(kind==="observation"){
    const shaft=box(2.3,height*.78,2.3,stone);group.add(shaft);
    const pod=new THREE.Mesh(new THREE.CylinderGeometry(7,5.2,4.2,18),glass);pod.position.y=height*.76;pod.castShadow=true;group.add(pod);
    const mast=box(.6,height*.22,.6,stone);mast.position.y=height*.9;group.add(mast);
  } else if(kind==="terraced"){
    for(let i=0;i<5;i++){const level=box(10-i*1.55,height/5,9-i*1.35,i%2?glass:stone);level.position.y=i*height/5+height/10;group.add(level);}
  } else {
    addTower(0,1);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(.75,height*.28,10),stone);spire.position.y=height*1.04;spire.castShadow=true;group.add(spire);
  }
  group.position.set(x,0,z);return group;
}

function addRoadMarkings(group,positions,horizontal,palette) {
  const material=mat(palette.accent,{roughness:.9});
  for(const value of positions){
    const count=28;
    const marks=new THREE.InstancedMesh(new THREE.BoxGeometry(horizontal?2:.12,.025,horizontal?.12:2),material,count);
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const along=(i-(count-1)/2)*4;
      dummy.position.set(horizontal?along:value,.045,horizontal?value:along);dummy.updateMatrix();marks.setMatrixAt(i,dummy.matrix);
    }
    marks.receiveShadow=true;group.add(marks);
  }
}

function createCivicSpace(group,kind,palette,block,random,treePoints) {
  const green=kind==="central_park"||kind==="promenade";
  const slab=box(block*.88,.14,block*.88,mat(green?palette.park:palette.walk));
  slab.position.y=.07;slab.name="city-civic-space";group.add(slab);
  if(green){
    for(let i=0;i<16;i++)treePoints.push({x:(random()-.5)*block*.72,z:(random()-.5)*block*.72,scale:.7+random()*.65});
  } else {
    const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(1.2,.27,48,8),mat(palette.accent,{metalness:.45,roughness:.32}));
    sculpture.position.y=2;sculpture.castShadow=true;group.add(sculpture);
  }
}

function addTrees(group,points,palette) {
  if(!points.length)return;
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.16,1.8,6),mat(0x5d4937),points.length);
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.8,1),mat(palette.park),points.length);
  const dummy=new THREE.Object3D();
  points.forEach((point,index)=>{
    dummy.position.set(point.x,.9*point.scale,point.z);dummy.scale.setScalar(point.scale);dummy.updateMatrix();trunk.setMatrixAt(index,dummy.matrix);
    dummy.position.y=2.05*point.scale;dummy.scale.set(point.scale,point.scale*1.15,point.scale);dummy.updateMatrix();crown.setMatrixAt(index,dummy.matrix);
  });
  trunk.castShadow=true;crown.castShadow=true;group.add(trunk,crown);
}

function addTraffic(group,plan,roads,extent,palette,random) {
  const setting=densitySettings[plan.density]||densitySettings.dense;
  const multiplier={light:.55,busy:1,intense:1.55}[plan.traffic]||1;
  const count=Math.round(setting.traffic*multiplier);
  const cars=new THREE.InstancedMesh(new THREE.BoxGeometry(1.35,.55,.7),mat(0xd85d49,{roughness:.55,metalness:.12}),count);
  const roofs=new THREE.InstancedMesh(new THREE.BoxGeometry(.72,.38,.64),mat(palette.glass,{roughness:.3,metalness:.2}),count);
  const dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const horizontal=i%2===0,road=roads[Math.floor(random()*roads.length)]||0,along=(random()-.5)*extent*.92;
    dummy.position.set(horizontal?along:road,horizontal?0:0,horizontal?road:along);dummy.position.y=.34;
    dummy.rotation.y=horizontal?0:Math.PI/2;dummy.updateMatrix();cars.setMatrixAt(i,dummy.matrix);
    dummy.position.y=.77;dummy.updateMatrix();roofs.setMatrixAt(i,dummy.matrix);
  }
  cars.castShadow=true;roofs.castShadow=true;group.add(cars,roofs);
  return count;
}

/** Expand a compact Jev city plan into a navigable multi-district world. */
export function createMetropolis(spec,random=Math.random) {
  const plan={archetype:"global",districts:"core_ring",roads:"avenue_grid",density:"dense",skyline:"single_core",waterfront:"none",civicSpace:"civic_plaza",traffic:"busy",landmark:"spire",...(spec.city||{})};
  const palette=cityPalettes[plan.archetype]||cityPalettes.global;
  const density=densitySettings[plan.density]||densitySettings.dense;
  const road=roadSettings[plan.roads]||roadSettings.avenue_grid;
  const extent=density.extent,half=extent/2,step=road.block+road.road;
  const group=new THREE.Group();group.name="metropolis-scene-pack";
  const landscapeGroup=new THREE.Group();landscapeGroup.name="metropolis-ground";group.add(landscapeGroup);
  const ground=box(extent,.18,extent,mat(palette.ground));ground.position.y=-.09;ground.receiveShadow=true;landscapeGroup.add(ground);

  if(plan.waterfront!=="none"){
    const waterWidth=plan.waterfront==="harbor"?extent*.24:plan.waterfront==="river"?extent*.13:extent*.08;
    const water=new THREE.Mesh(new THREE.PlaneGeometry(extent*1.35,waterWidth),mat(0x3f8fa4,{roughness:.24,metalness:.22}));
    water.rotation.x=-Math.PI/2;water.position.set(0,.015,-half+waterWidth/2);landscapeGroup.add(water);
  }

  const roadPositions=[];
  for(let value=-half+step;value<half-step*.4;value+=step)roadPositions.push(value);
  for(const value of roadPositions){
    const horizontal=box(extent,.05,road.road,mat(palette.road));horizontal.position.set(0,.025,value);landscapeGroup.add(horizontal);
    const vertical=box(road.road,.052,extent,mat(palette.road));vertical.position.set(value,.026,0);landscapeGroup.add(vertical);
  }
  addRoadMarkings(landscapeGroup,roadPositions,true,palette);
  addRoadMarkings(landscapeGroup,roadPositions,false,palette);

  const items=[],treePoints=[];
  let buildingIndex=0,blockCount=0;
  const districtCounts={business:0,mixed:0,residential:0,innovation:0,entertainment:0,waterfront:0};
  const civicCenter={x:0,z:0};
  const landmarkPosition={x:step*.52,z:-step*.52};
  const firstCenter=-half+step/2;
  for(let x=firstCenter;x<half;x+=step)for(let z=firstCenter;z<half;z+=step){
    if(Math.abs(x)>half-step*.32||Math.abs(z)>half-step*.32)continue;
    if(plan.waterfront!=="none"&&z<-half+extent*.24)continue;
    blockCount++;
    const civic=Math.hypot(x-civicCenter.x,z-civicCenter.z)<step*.48;
    const landmarkBlock=Math.hypot(x-landmarkPosition.x,z-landmarkPosition.z)<step*.45;
    if(civic){createCivicSpace(group,plan.civicSpace,palette,road.block,random,treePoints);continue;}
    const sidewalk=box(road.block,.16,road.block,mat(palette.walk));sidewalk.position.set(x,.08,z);sidewalk.receiveShadow=true;group.add(sidewalk);
    if(landmarkBlock)continue;
    const blockStrength=skylineStrength(plan.skyline,x,z,extent);
    const district=districtFor(plan.districts,x,z,extent,blockStrength);
    districtCounts[district]++;
    const lots=plan.roads==="superblocks"?3:plan.roads==="tight_grid"?2:plan.density==="urban"?2:density.lots;
    const lot=road.block/lots;
    for(let ix=0;ix<lots;ix++)for(let iz=0;iz<lots;iz++){
      if(random()<(plan.density==="urban"?.16:.07))continue;
      const bx=x+(ix-(lots-1)/2)*lot,bz=z+(iz-(lots-1)/2)*lot;
      const strength=skylineStrength(plan.skyline,bx,bz,extent);
      let height=(5+random()*7+strength*(30+random()*30))*density.height;
      height*=({business:1.12,mixed:.8,residential:.52,innovation:.9,entertainment:.45,waterfront:.88}[district]||1);
      if(plan.archetype==="sunbelt")height*=.72;
      if(plan.archetype==="coastal_tech"&&strength>.55)height*=1.16;
      const width=lot*(.62+random()*.18),depth=lot*(.62+random()*.18);
      const model=makeBuilding({x:bx,z:bz,width,depth,height,style:plan.archetype,palette,random,index:buildingIndex});
      group.add(model);
      items.push({type:"city_building",group:"architecture",district,model,x:bx,z:bz,width,depth,height,label:`${district} building · ${buildingIndex+1}`,index:buildingIndex,count:1,editable:false});
      buildingIndex++;
    }
    // A restrained tree rhythm along block corners creates readable streets.
    if((Math.round((x+z)/step)&1)===0){
      const inset=road.block*.39;
      treePoints.push({x:x-inset,z:z-inset,scale:.75+random()*.35},{x:x+inset,z:z+inset,scale:.75+random()*.35});
    }
  }
  const landmarkHeight=(plan.density==="megacity"?88:72)*(plan.archetype==="sunbelt"?.82:1);
  const landmark=makeLandmark(plan.landmark,palette,landmarkPosition.x,landmarkPosition.z,landmarkHeight);
  group.add(landmark);
  items.push({type:"city_landmark",group:"landmark",model:landmark,x:landmarkPosition.x,z:landmarkPosition.z,width:13,depth:13,height:landmarkHeight,label:"City landmark",index:0,count:1,editable:false});
  addTrees(group,treePoints,palette);
  const trafficCount=addTraffic(group,plan,roadPositions,extent,palette,random);

  const paths=[];
  const pathGroup=new THREE.Group();pathGroup.name="walking-paths";landscapeGroup.add(pathGroup);
  const landscape={group:landscapeGroup,heightAt:()=>.18,paths,extent:extent*1.4,pathGroup};
  const layout={items,landRadius:extent*.72,roadZ:0,city:true};
  group.userData.cityStats={buildings:buildingIndex,blocks:blockCount,roads:roadPositions.length*2,traffic:trafficCount,extent,districts:districtCounts};
  group.userData.cityPlan=plan;
  return {group,landscape,layout,stats:group.userData.cityStats,palette};
}
