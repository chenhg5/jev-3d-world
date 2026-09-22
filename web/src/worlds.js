import * as THREE from "three";

const standard=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.03,...options});
function box(w,h,d,material,x=0,y=0,z=0){
  const object=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  object.position.set(x,y+h/2,z);object.castShadow=true;object.receiveShadow=true;return object;
}
function cylinder(rt,rb,h,material,x=0,y=0,z=0,segments=12){
  const object=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);
  object.position.set(x,y+h/2,z);object.castShadow=true;object.receiveShadow=true;return object;
}
function landscapeContract(group,heightAt,extent){
  const pathGroup=new THREE.Group();pathGroup.name="walking-paths";group.add(pathGroup);
  return {group,heightAt,extent,paths:[],pathGroup};
}
function item(model,type,group,x,z,width,depth,height,index=0){
  model.name=`${type}-${index}`;
  return {model,type,group,x,z,width,depth,height,index,count:1,label:type.replaceAll("_"," "),editable:false};
}
function seededPick(random,values){return values[Math.floor(random()*values.length)];}

function linerHull(material){
  const shape=new THREE.Shape();
  shape.moveTo(-56,0);shape.lineTo(-49,5.5);shape.lineTo(38,5.5);shape.lineTo(55,2.5);shape.lineTo(48,0);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:18,bevelEnabled:true,bevelThickness:.8,bevelSize:.7,bevelSegments:2});
  const hull=new THREE.Mesh(geometry,material);hull.position.z=-9;hull.castShadow=true;hull.receiveShadow=true;return hull;
}
function addDeckPeople(group,count,random,y){
  const bodies=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.16,.5,3,5),standard(0x4b5965),count);
  const dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const side=i%2?1:-1;dummy.position.set(-42+random()*82,y+.5,side*(5.8+random()*1.2));dummy.rotation.y=random()*6.28;dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
  }
  bodies.castShadow=true;group.add(bodies);
}
function createOceanLiner(spec,random){
  const plan=spec.world||{},group=new THREE.Group();group.name="ocean-liner-scene-pack";
  const waterGroup=new THREE.Group();waterGroup.name="liner-ocean";group.add(waterGroup);
  const waterMat=standard(plan.topology==="storm_passage"?0x173744:0x307f98,{roughness:.2,metalness:.26});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(320,240,30,20),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.25;water.receiveShadow=true;waterGroup.add(water);
  const ship=new THREE.Group();ship.name="procedural-ocean-liner";group.add(ship);
  ship.add(linerHull(standard(0x202a31,{roughness:.54,metalness:.14})));
  ship.add(box(98,.42,16,standard(0xe1d9c8),-1,5.45,0));
  const layers={elegant:2,grand:3,monumental:4}[plan.density]||3;
  const items=[];
  for(let level=0;level<layers;level++){
    const width=64-level*7+(random()-.5)*3,depth=12-level*1.1+(random()-.5)*.7,height=2.2;
    const model=new THREE.Group();model.add(box(width,height,depth,standard(level%2?0xf0e9dc:0xd4d8d5),0,0,0));
    const windowMat=standard(0x5f91a5,{roughness:.25,metalness:.2,emissive:0x31515f,emissiveIntensity:.12});
    for(let x=-width/2+2;x<width/2-1;x+=3.1){
      model.add(box(1,.42,.08,windowMat,x,.9,-depth/2-.05));
      model.add(box(1,.42,.08,windowMat,x,.9,depth/2+.05));
    }
    model.position.set(-4,5.85+level*2.15,0);ship.add(model);
    items.push(item(model,"liner_superstructure","architecture",-4,0,width,depth,height,level));
  }
  const funnelCounts={four_funnels:4,three_funnels:3,twin_funnels:2,observation_mast:2};
  const funnelCount=funnelCounts[plan.landmark]||4;
  for(let i=0;i<funnelCount;i++){
    const x=(i-(funnelCount-1)/2)*13-4;
    const funnel=new THREE.Group();
    funnel.add(cylinder(2.15,2.35,5.7,standard(0xc58d45),0,0,0,16));
    funnel.add(cylinder(2.18,2.18,1.05,standard(0x202427),0,5.65,0,16));
    funnel.position.set(x,5.8+layers*2.15,0);ship.add(funnel);
  }
  const boatCount=plan.population==="evacuation"?18:12;
  for(let i=0;i<boatCount;i++){
    const side=i%2?1:-1,x=-38+Math.floor(i/2)*13;
    const boat=box(7,.7,1.55,standard(0xd2b067),x,8.2,side*7.1);boat.rotation.z=side*.06;ship.add(boat);
  }
  for(const x of [-45,42]){const mast=cylinder(.25,.34,13,standard(0x4e4035),x,7,0,8);ship.add(mast);}
  const barriers=[
    {x:0,z:-8.2,w:106,d:.35},{x:0,z:8.2,w:106,d:.35},{x:-52.5,z:0,w:.35,d:16},{x:51.5,z:0,w:.35,d:16},
  ];
  for(const [index,b] of barriers.entries()){
    const rail=box(b.w,1,b.d,standard(0x8f9695),b.x,6,b.z);ship.add(rail);
    items.push(item(rail,"deck_rail","architecture",b.x,b.z,b.w,b.d,1,index));
  }
  if(plan.population!=="quiet_voyage")addDeckPeople(ship,plan.population==="evacuation"?46:28,random,6.1);
  if(plan.topology==="ice_field"||plan.hazard==="iceberg"){
    for(let i=0;i<5;i++){
      const ice=new THREE.Mesh(new THREE.DodecahedronGeometry(4+random()*4,1),standard(0xd7eef0));
      ice.scale.set(1.5,.8+random(),1);ice.position.set(-75+i*35,-.1,(i%2?1:-1)*(28+random()*24));ice.castShadow=true;group.add(ice);
    }
  }
  if(plan.topology==="harbor_departure"){
    const dock=box(100,.8,12,standard(0x6c6257),0,.2,-25);group.add(dock);
  }
  const heightAt=()=>5.9;
  const landscape=landscapeContract(waterGroup,heightAt,320);
  const layout={items,landRadius:54,sceneExtent:120,largeWorld:true,avatarScale:.78,cameraTargetY:8,cameraProfile:"wide",worldFamily:"ocean_liner"};
  group.userData.worldStats={family:"ocean_liner",decks:layers,funnels:funnelCount,lifeboats:boatCount};
  return {group,landscape,layout,stats:group.userData.worldStats};
}

function terrainPlane(extent,heightAt,color){
  const geometry=new THREE.PlaneGeometry(extent,extent,72,72);geometry.rotateX(-Math.PI/2);
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++)position.setY(i,heightAt(position.getX(i),position.getZ(i)));
  geometry.computeVertexNormals();
  const ground=new THREE.Mesh(geometry,standard(color));ground.receiveShadow=true;return ground;
}
function dinosaur(species,scale,color){
  const group=new THREE.Group(),skin=standard(color),dark=standard(new THREE.Color(color).multiplyScalar(.62));
  const ellipsoid=(radius,position,s)=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,1),skin);m.position.set(...position);m.scale.set(...s);m.castShadow=true;group.add(m);return m;};
  const limb=(x,z,h)=>{const leg=cylinder(.22*scale,.3*scale,h,dark,x,0,z,7);group.add(leg);};
  if(species==="sauropod"){
    ellipsoid(1,[0,2.1*scale,0],[3.8*scale,1.35*scale,1.35*scale]);
    for(const [x,z] of [[-2.1,-.7],[-2.1,.7],[2,-.7],[2,.7]])limb(x*scale,z*scale,2*scale);
    const neck=cylinder(.48*scale,.75*scale,5.2*scale,skin,2.7*scale,2.5*scale,0,9);neck.rotation.z=-.32;group.add(neck);
    ellipsoid(.75,[3.6*scale,7.1*scale,0],[1.1, .8, .75]);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.75*scale,6*scale,8),skin);tail.rotation.z=-Math.PI/2;tail.position.set(-5.2*scale,2.3*scale,0);tail.castShadow=true;group.add(tail);
  }else{
    const horned=species==="triceratops",raptor=species==="raptor";
    const bodyScale=raptor?.62:1;
    ellipsoid(1,[0,1.7*scale,0],[2.5*scale*bodyScale,1.15*scale*bodyScale,1.05*scale*bodyScale]);
    for(const [x,z] of [[-1,-.55],[1,-.55],[-1,.55],[1,.55]])limb(x*scale*bodyScale,z*scale*bodyScale,(raptor?1.2:1.6)*scale);
    ellipsoid(.72,[2.35*scale*bodyScale,2.4*scale,0],[1.25,1,.8]);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.62*scale*bodyScale,4.5*scale*bodyScale,8),skin);tail.rotation.z=-Math.PI/2;tail.position.set(-3.2*scale*bodyScale,2*scale,0);tail.castShadow=true;group.add(tail);
    if(horned)for(const z of [-.32,.32]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.12*scale,1.35*scale,7),standard(0xe0d5ad));horn.rotation.z=-Math.PI/2;horn.position.set(3.2*scale,2.65*scale,z*scale);group.add(horn);}
  }
  group.userData.species=species;return group;
}
function addForest(group,count,extent,heightAt,random,color=0x285d3d,clearRadius=29){
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.28,2.7,6),standard(0x5b4430),count);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25,1),standard(color),count);
  const dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    let angle=random()*Math.PI*2;
    // The default camera looks in from +X/+Z. Preserve a broad foreground
    // valley so animals and landmarks remain readable through dense forest.
    for(let attempt=0;attempt<12&&Math.cos(angle-Math.PI/4)>.28;attempt++)angle=random()*Math.PI*2;
    const radius=clearRadius+Math.sqrt(random())*(extent*.46-clearRadius),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,s=.75+random()*1.45,y=heightAt(x,z);
    dummy.position.set(x,y+1.35*s,z);dummy.scale.set(s,s,s);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.y=y+3.25*s;dummy.scale.set(s,s*(.85+random()*.35),s);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
  }
  trunks.castShadow=true;crowns.castShadow=true;group.add(trunks,crowns);
}
function createPrehistoric(spec,random){
  const plan=spec.world||{},extent={open:100,lush:120,primeval:138}[plan.density]||120;
  const group=new THREE.Group();group.name="prehistoric-scene-pack";
  const groundGroup=new THREE.Group();groundGroup.name="prehistoric-landscape";group.add(groundGroup);
  const heightAt=(x,z)=>Math.sin(x*.045)*.25+Math.cos(z*.052)*.22;
  groundGroup.add(terrainPlane(extent,heightAt,plan.hazard==="eruption"?0x46523a:0x426947));
  if(plan.topology==="river_corridor"){
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-extent*.5,.12,-20),new THREE.Vector3(-20,.12,4),new THREE.Vector3(18,.12,-5),new THREE.Vector3(extent*.5,.12,18)]);
    const river=new THREE.Mesh(new THREE.TubeGeometry(curve,50,3.2,8,false),standard(0x348da0,{roughness:.25,metalness:.15}));groundGroup.add(river);
  }
  addForest(group,{open:80,lush:180,primeval:310}[plan.density]||180,extent,heightAt,random,0x285d3d,plan.density==="primeval"?27:30);
  const landmarkX=-extent*.3,landmarkZ=-extent*.28;
  if(plan.landmark==="stone_arch"){
    const arch=new THREE.Mesh(new THREE.TorusGeometry(10,2.3,10,30,Math.PI),standard(0x615c4d));arch.position.set(landmarkX,2,landmarkZ);arch.rotation.z=Math.PI;arch.castShadow=true;group.add(arch);
  }else{
    const volcanic=plan.landmark==="volcano"||plan.hazard==="eruption";
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(volcanic?15:19,volcanic?28:22,9),standard(volcanic?0x403a37:0x52604b));
    mountain.position.set(landmarkX,(volcanic?28:22)/2,landmarkZ);mountain.castShadow=true;group.add(mountain);
    if(volcanic){const crater=new THREE.PointLight(0xff6b2d,35,45);crater.position.set(landmarkX,27,landmarkZ);group.add(crater);}
  }
  if(plan.feature==="park_gate"){
    const gate=new THREE.Group();gate.add(box(16,2.2,1.4,standard(0x4a3b2e),0,0,0),box(2,9,2,standard(0x66513a),-8,0,0),box(2,9,2,standard(0x66513a),8,0,0));gate.position.set(0,0,20);group.add(gate);
  }else if(plan.feature==="research_outpost"){
    const outpost=new THREE.Group();outpost.add(box(13,3.5,7,standard(0xa6aa9c),0,0,0),box(5,2,4,standard(0x56717a),0,3.5,0));outpost.position.set(0,heightAt(0,20),20);group.add(outpost);
  }else if(plan.feature==="nesting_ground"){
    for(let i=0;i<12;i++){const egg=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),standard(0xd8d0ad));egg.scale.y=1.35;egg.position.set((random()-.5)*10,.65,(random()-.5)*8+12);group.add(egg);}
  }else{
    const cliff=box(20,16,7,standard(0x565c4d),0,0,-28);group.add(cliff);
    const falls=box(6,14,.3,standard(0x75c5d1,{roughness:.2,transparent:true,opacity:.82}),0,1,-24.4);group.add(falls);
  }
  const mixes={
    herbivore_herd:[["sauropod",3,1],["triceratops",6,.75]],
    predator_hunt:[["trex",2,1],["raptor",8,.55]],
    mixed_ecosystem:[["sauropod",2,.9],["triceratops",4,.7],["trex",1,.9],["raptor",5,.5]],
    giant_dominant:[["sauropod",1,1.5],["triceratops",3,.65]],
  };
  const population=mixes[plan.population]||mixes.mixed_ecosystem,items=[];let index=0;
  for(const [species,count,scale] of population)for(let i=0;i<count;i++){
    const angle=(index+1)*2.399,radius=index===0?12:7+Math.sqrt(index+1)*5.2,x=index===0?10:Math.cos(angle)*radius,z=index===0?10:Math.sin(angle)*radius;
    const model=dinosaur(species,scale,index===0?0x91a958:seededPick(random,[0x557b48,0x6f7847,0x786044,0x456b59]));model.position.set(x,heightAt(x,z),z);model.rotation.y=random()*6.28;group.add(model);
    items.push(item(model,species,"animal",x,z,8*scale,3*scale,7*scale,index++));
  }
  const landscape=landscapeContract(groundGroup,heightAt,extent);
  const layout={items,landRadius:extent*.47,sceneExtent:extent,largeWorld:true,avatarScale:.82,cameraTargetY:5,worldFamily:"prehistoric"};
  group.userData.worldStats={family:"prehistoric",dinosaurs:index,trees:{open:80,lush:180,primeval:310}[plan.density]||180};
  return {group,landscape,layout,stats:group.userData.worldStats};
}

function medievalHouse(index,random,palette){
  const group=new THREE.Group(),w=3+random()*2,d=3+random()*2,h=2.7+random()*2;
  group.add(box(w,h,d,standard(seededPick(random,palette.walls)),0,0,0));
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2+random(),4),standard(palette.roof));roof.position.y=h+1;roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
  const door=box(.7,1.35,.12,standard(0x4b3525),0,0,-d/2-.08);group.add(door);group.userData.size={w,d,h:h+2};group.name=`medieval-house-${index}`;return group;
}
function createMedievalCity(spec,random){
  const plan=spec.world||{},extent={frontier:76,thriving:96,capital:118}[plan.density]||96;
  const winter=plan.hazard==="winter",palette={walls:winter?[0x9a9b98,0x777b7d]:[0x887966,0xa38b6d,0x71675d],roof:winter?0x4d5960:0x5d352c};
  const group=new THREE.Group();group.name="medieval-city-scene-pack";
  const groundGroup=new THREE.Group();groundGroup.name="medieval-landscape";group.add(groundGroup);
  const heightAt=()=>.12;groundGroup.add(terrainPlane(extent,heightAt,winter?0xdce4e4:0x607046));
  if(plan.topology==="river_crossing"||plan.archetype==="river_fortress"){
    const river=box(12,.08,extent,standard(0x397f94,{roughness:.26}),-18,.1,0);groundGroup.add(river);
    const bridge=box(18,1.1,6,standard(0x81786c),-18,.14,0);group.add(bridge);
  }
  const items=[],wallMaterial=standard(0x716d65),wallRadius=extent*.36;
  const wallSegments=20;
  for(let i=0;i<wallSegments;i++){
    const angle=i/wallSegments*Math.PI*2,x=Math.cos(angle)*wallRadius,z=Math.sin(angle)*wallRadius,length=2*Math.PI*wallRadius/wallSegments+1;
    const wall=box(length,5,1.7,wallMaterial,x,0,z);wall.rotation.y=-angle;group.add(wall);
    items.push(item(wall,"city_wall","architecture",x,z,length,1.7,5,i));
    if(i%4===0){const tower=cylinder(2.8,3.2,9,wallMaterial,x,0,z,10);group.add(tower);items.push(item(tower,"wall_tower","architecture",x,z,5.6,5.6,9,i));}
  }
  const houseCount={frontier:28,thriving:62,capital:112}[plan.density]||62;
  for(let i=0;i<houseCount;i++){
    const angle=i*2.399+(random()-.5)*.2,radius=10+Math.sqrt(i/houseCount)*wallRadius*.72,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(plan.topology==="river_crossing"&&Math.abs(x+18)<8)continue;
    const model=medievalHouse(i,random,palette);model.position.set(x,.12,z);model.rotation.y=angle+Math.PI/2;group.add(model);
    const size=model.userData.size;items.push(item(model,"medieval_house","architecture",x,z,size.w,size.d,size.h,i));
  }
  const citadel=new THREE.Group();citadel.name="upper-citadel";
  const keepHeight=plan.landmark==="citadel_spire"?22:plan.landmark==="high_keep"?18:plan.landmark==="many_towers"?17:14;
  citadel.add(box(18,5,16,wallMaterial,0,0,0),box(10,keepHeight,10,standard(0x80796d),0,5,0));
  for(const [x,z] of [[-8,-7],[-8,7],[8,-7],[8,7]])citadel.add(cylinder(2.2,2.6,12,wallMaterial,x,0,z,10));
  if(plan.landmark==="citadel_spire"){const spire=new THREE.Mesh(new THREE.ConeGeometry(3,10,8),standard(palette.roof));spire.position.y=keepHeight+10;citadel.add(spire);}
  else {const roof=new THREE.Mesh(new THREE.ConeGeometry(7.2,6,4),standard(palette.roof));roof.position.y=keepHeight+8;roof.rotation.y=Math.PI/4;roof.castShadow=true;citadel.add(roof);}
  group.add(citadel);items.push(item(citadel,"citadel","landmark",0,0,20,18,keepHeight+10,0));
  if(plan.feature==="market_square"){
    const square=box(17,.18,13,standard(0xa79a7f),0,.12,20);group.add(square);
    for(let i=0;i<8;i++){const stall=box(2,1.5,1.5,standard(i%2?0x9d4d42:0xd2aa55),(i-3.5)*2.2,.3,20+(i%2?4:-4));group.add(stall);}
  }else if(plan.feature==="great_hall"){
    const hall=box(25,7,10,standard(0x8d8171),0,.12,19);group.add(hall);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(14,6,4),standard(palette.roof));roof.position.set(0,10.1,19);roof.rotation.y=Math.PI/4;group.add(roof);
  }else if(plan.feature==="temple_close"){
    const temple=box(10,11,18,standard(0x918879),0,.12,20);group.add(temple);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(3,10,8),standard(palette.roof));spire.position.set(0,16,20);group.add(spire);
  }
  if(plan.hazard==="fire"){
    for(let i=0;i<5;i++){const light=new THREE.PointLight(0xff642f,22,18);light.position.set((random()-.5)*30,3,(random()-.5)*30);group.add(light);}
  }
  const landscape=landscapeContract(groundGroup,heightAt,extent);
  const layout={items,landRadius:extent*.47,sceneExtent:extent,largeWorld:true,avatarScale:.78,cameraTargetY:7,worldFamily:"medieval_city"};
  group.userData.worldStats={family:"medieval_city",houses:houseCount,walls:wallSegments,towers:5};
  return {group,landscape,layout,stats:group.userData.worldStats};
}

export function createLargeWorld(spec,random=Math.random){
  if(spec.scenePack==="ocean_liner")return createOceanLiner(spec,random);
  if(spec.scenePack==="prehistoric")return createPrehistoric(spec,random);
  if(spec.scenePack==="medieval_city")return createMedievalCity(spec,random);
  throw new Error("Unsupported large world family: "+spec.scenePack);
}
