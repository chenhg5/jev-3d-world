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
  return {model,type,group,x,z,width,depth,height,index,count:1,label:`${type.replaceAll("_"," ")} · ${index+1}`,editable:true};
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
  const ship=new THREE.Group(),items=[];ship.name="procedural-ocean-liner";group.add(ship);
  const vessel=new THREE.Group();vessel.name="liner-hull-and-deck";
  vessel.add(linerHull(standard(0x202a31,{roughness:.54,metalness:.14})));
  vessel.add(box(98,.42,16,standard(0xe1d9c8),-1,5.45,0));ship.add(vessel);
  const vesselItem=item(vessel,"ocean_liner_hull","platform",0,0,112,18,6,0);vesselItem.collidable=false;items.push(vesselItem);
  const layers={elegant:2,grand:3,monumental:4}[plan.density]||3;
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
    items.push(item(funnel,"liner_funnel","landmark",x,0,4.7,4.7,6.7,i));
  }
  const boatCount=plan.population==="evacuation"?18:12;
  for(let i=0;i<boatCount;i++){
    const side=i%2?1:-1,x=-38+Math.floor(i/2)*13;
    const boat=box(7,.7,1.55,standard(0xd2b067),x,8.2,side*7.1);boat.rotation.z=side*.06;ship.add(boat);
    items.push(item(boat,"lifeboat","vehicle",x,side*7.1,7,1.55,.7,i));
  }
  for(const [index,x] of [-45,42].entries()){
    const mast=cylinder(.25,.34,13,standard(0x4e4035),x,7,0,8);ship.add(mast);
    items.push(item(mast,"liner_mast","landmark",x,0,.7,.7,13,index));
  }
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
      const size=new THREE.Box3().setFromObject(ice).getSize(new THREE.Vector3());items.push(item(ice,"iceberg","terrain",ice.position.x,ice.position.z,size.x,size.z,size.y,i));
    }
  }
  if(plan.topology==="harbor_departure"){
    const dock=box(100,.8,12,standard(0x6c6257),0,.2,-25);group.add(dock);
    items.push(item(dock,"harbor_dock","architecture",0,-25,100,12,.8,0));
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
  const heightAt=(x,z)=>Math.sin(x*.045)*.25+Math.cos(z*.052)*.22,items=[];
  groundGroup.add(terrainPlane(extent,heightAt,plan.hazard==="eruption"?0x46523a:0x426947));
  if(plan.topology==="river_corridor"){
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-extent*.5,.12,-20),new THREE.Vector3(-20,.12,4),new THREE.Vector3(18,.12,-5),new THREE.Vector3(extent*.5,.12,18)]);
    const river=new THREE.Mesh(new THREE.TubeGeometry(curve,50,3.2,8,false),standard(0x348da0,{roughness:.25,metalness:.15}));groundGroup.add(river);
  }
  addForest(group,{open:80,lush:180,primeval:310}[plan.density]||180,extent,heightAt,random,0x285d3d,plan.density==="primeval"?27:30);
  const landmarkX=-extent*.3,landmarkZ=-extent*.28;
  if(plan.landmark==="stone_arch"){
    const arch=new THREE.Mesh(new THREE.TorusGeometry(10,2.3,10,30,Math.PI),standard(0x615c4d));arch.position.set(landmarkX,2,landmarkZ);arch.rotation.z=Math.PI;arch.castShadow=true;group.add(arch);
    items.push(item(arch,"stone_arch","landmark",landmarkX,landmarkZ,20,4.6,12,0));
  }else{
    const volcanic=plan.landmark==="volcano"||plan.hazard==="eruption";
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(volcanic?15:19,volcanic?28:22,9),standard(volcanic?0x403a37:0x52604b));
    mountain.position.set(landmarkX,(volcanic?28:22)/2,landmarkZ);mountain.castShadow=true;group.add(mountain);
    items.push(item(mountain,volcanic?"volcano":"mountain","terrain",landmarkX,landmarkZ,volcanic?30:38,volcanic?30:38,volcanic?28:22,0));
    if(volcanic){const crater=new THREE.PointLight(0xff6b2d,35,45);crater.position.set(landmarkX,27,landmarkZ);group.add(crater);}
  }
  if(plan.feature==="park_gate"){
    const gate=new THREE.Group();gate.add(box(16,2.2,1.4,standard(0x4a3b2e),0,0,0),box(2,9,2,standard(0x66513a),-8,0,0),box(2,9,2,standard(0x66513a),8,0,0));gate.position.set(0,0,20);group.add(gate);
    items.push(item(gate,"park_gate","architecture",0,20,18,2,9,0));
  }else if(plan.feature==="research_outpost"){
    const outpost=new THREE.Group();outpost.add(box(13,3.5,7,standard(0xa6aa9c),0,0,0),box(5,2,4,standard(0x56717a),0,3.5,0));outpost.position.set(0,heightAt(0,20),20);group.add(outpost);
    items.push(item(outpost,"research_outpost","architecture",0,20,13,7,5.5,0));
  }else if(plan.feature==="nesting_ground"){
    for(let i=0;i<12;i++){
      const egg=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),standard(0xd8d0ad));egg.scale.y=1.35;egg.position.set((random()-.5)*10,.65,(random()-.5)*8+12);group.add(egg);
      items.push(item(egg,"dinosaur_egg","decor",egg.position.x,egg.position.z,1.1,1.1,1.5,i));
    }
  }else{
    const cliff=box(20,16,7,standard(0x565c4d),0,0,-28);group.add(cliff);
    const falls=box(6,14,.3,standard(0x75c5d1,{roughness:.2,transparent:true,opacity:.82}),0,1,-24.4);group.add(falls);
    items.push(item(cliff,"waterfall_cliff","terrain",0,-28,20,7,16,0),item(falls,"waterfall","water",0,-24.4,6,.3,14,0));
  }
  const mixes={
    herbivore_herd:[["sauropod",3,1],["triceratops",6,.75]],
    predator_hunt:[["trex",2,1],["raptor",8,.55]],
    mixed_ecosystem:[["sauropod",2,.9],["triceratops",4,.7],["trex",1,.9],["raptor",5,.5]],
    giant_dominant:[["sauropod",1,1.5],["triceratops",3,.65]],
  };
  const population=mixes[plan.population]||mixes.mixed_ecosystem;let index=0;
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
  const heightAt=()=>.12,items=[];groundGroup.add(terrainPlane(extent,heightAt,winter?0xdce4e4:0x607046));
  if(plan.topology==="river_crossing"||plan.archetype==="river_fortress"){
    const river=box(12,.08,extent,standard(0x397f94,{roughness:.26}),-18,.1,0);groundGroup.add(river);
    const bridge=box(18,1.1,6,standard(0x81786c),-18,.14,0);group.add(bridge);
    items.push(item(bridge,"stone_bridge","architecture",-18,0,18,6,1.1,0));
  }
  const wallMaterial=standard(0x716d65),wallRadius=extent*.36;
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
    for(let i=0;i<8;i++){
      const x=(i-3.5)*2.2,z=20+(i%2?4:-4),stall=box(2,1.5,1.5,standard(i%2?0x9d4d42:0xd2aa55),x,.3,z);group.add(stall);
      items.push(item(stall,"market_stall","decor",x,z,2,1.5,1.5,i));
    }
  }else if(plan.feature==="great_hall"){
    const hall=new THREE.Group();hall.add(box(25,7,10,standard(0x8d8171),0,0,0));
    const roof=new THREE.Mesh(new THREE.ConeGeometry(14,6,4),standard(palette.roof));roof.position.set(0,10,0);roof.rotation.y=Math.PI/4;hall.add(roof);hall.position.set(0,.12,19);group.add(hall);
    items.push(item(hall,"great_hall","landmark",0,19,25,14,13,0));
  }else if(plan.feature==="temple_close"){
    const temple=new THREE.Group();temple.add(box(10,11,18,standard(0x918879),0,0,0));
    const spire=new THREE.Mesh(new THREE.ConeGeometry(3,10,8),standard(palette.roof));spire.position.set(0,16,0);temple.add(spire);temple.position.set(0,.12,20);group.add(temple);
    items.push(item(temple,"temple","landmark",0,20,10,18,21,0));
  }
  if(plan.hazard==="fire"){
    for(let i=0;i<5;i++){const light=new THREE.PointLight(0xff642f,22,18);light.position.set((random()-.5)*30,3,(random()-.5)*30);group.add(light);}
  }
  const landscape=landscapeContract(groundGroup,heightAt,extent);
  const layout={items,landRadius:extent*.47,sceneExtent:extent,largeWorld:true,avatarScale:.78,cameraTargetY:7,worldFamily:"medieval_city"};
  group.userData.worldStats={family:"medieval_city",houses:houseCount,walls:wallSegments,towers:5};
  return {group,landscape,layout,stats:group.userData.worldStats};
}

const interiorPalettes={
  classroom:{floor:0xb5a37f,wall:0xe5e0d2,accent:0x477b72,furniture:0x8a6a45},
  hospital_ward:{floor:0xb9c8c7,wall:0xe9efec,accent:0x57a0a1,furniture:0xd8e2df},
  office:{floor:0x62686b,wall:0xd8d5ce,accent:0x4d7c96,furniture:0x6d6258},
  apartment:{floor:0x9a7958,wall:0xe3d5c4,accent:0xa95f4b,furniture:0x6f5140},
  restaurant:{floor:0x765b45,wall:0xc7a989,accent:0xb64f3f,furniture:0x5e3e2d},
  library:{floor:0x72583f,wall:0xc7b596,accent:0x5d704f,furniture:0x59402d},
  laboratory:{floor:0x9ba5a5,wall:0xd8dfdf,accent:0x4f91ae,furniture:0xb6c0c1},
  gallery:{floor:0xc9c5bc,wall:0xeeeae1,accent:0xb26d45,furniture:0x77736e},
};

function interiorStation(kind,index,random,palette){
  const group=new THREE.Group();let width=2.5,depth=1.4,height=2,type=kind+"_station";
  const wood=standard(palette.furniture),accent=standard(palette.accent),pale=standard(0xe8e5dc),dark=standard(0x30373b);
  if(kind==="hospital_ward"){
    width=2.5;depth=1.25;height=1.45;type="hospital_bed";
    group.add(box(2.25,.48,1.05,standard(0xe7eeee),0,.48,0),box(2.35,.65,.12,accent,-.02,0, -.52));
    const pillow=box(.55,.18,.82,pale,-.68,.97,0);group.add(pillow);
  }else if(kind==="library"){
    width=2.7;depth=.72;height=3.25;type="bookshelf";group.add(box(width,height,depth,wood));
    for(let y=.7;y<height;y+=.68)group.add(box(width*.92,.1,depth+.06,dark,0,y,0));
    for(let x=-1.05;x<1.1;x+=.35)group.add(box(.22,.48,.08,standard([0x9b4f43,0x53728b,0x8a7848,0x54725c][Math.abs(Math.round(x*10)+index)%4]),x,.2,-depth/2-.05));
  }else if(kind==="restaurant"){
    width=3.1;depth=3.1;height=1.25;type="dining_set";
    const top=cylinder(1.05,1.05,.16,wood,0,.78,0,18);group.add(top,cylinder(.18,.26,.78,dark));
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const chair=box(.62,.75,.62,accent,Math.cos(a)*1.25,0,Math.sin(a)*1.25);group.add(chair);}
  }else if(kind==="apartment"){
    if(index%2===0){width=2.8;depth=1.05;height=1.15;type="sofa";group.add(box(width,.55,depth,accent),box(width,.72,.25,accent,0,.5,.4));}
    else {width=2.2;depth=1.25;height=.9;type="coffee_table";group.add(box(width,.16,depth,wood,0,.64,0),box(.16,.65,.16,dark,-.78,0,-.38),box(.16,.65,.16,dark,.78,0,.38));}
  }else if(kind==="gallery"){
    width=1.7;depth=1.7;height=2.8;type="exhibit";group.add(box(1.25,.72,1.25,pale));
    const art=new THREE.Mesh(index%2?new THREE.TorusKnotGeometry(.5,.16,36,7):new THREE.IcosahedronGeometry(.65,1),accent);art.position.y=1.65;art.castShadow=true;group.add(art);
  }else{
    const lab=kind==="laboratory",office=kind==="office";
    width=lab?3.2:2.5;depth=lab?1.2:1.35;height=lab?2.1:1.8;type=lab?"lab_bench":office?"workstation":"student_desk";
    group.add(box(width,.16,depth,wood,0,.72,0),box(.14,.72,.14,dark,-width*.38,0,-depth*.32),box(.14,.72,.14,dark,width*.38,0,depth*.32));
    if(office||lab){const screen=box(.82,.6,.08,dark,0,.88,-.2);group.add(screen);}
    if(lab){for(const x of [-.85,.8]){const glass=cylinder(.16,.2,.65,standard(0x8ccbd0,{transparent:true,opacity:.72}),x,.9,0,12);group.add(glass);}}
    else {group.add(box(.6,.72,.62,accent,0,0,depth*.72));}
  }
  group.userData.size={width,depth,height};return {group,width,depth,height,type};
}

function interiorLandmark(kind,palette){
  const group=new THREE.Group(),accent=standard(palette.accent),wood=standard(palette.furniture),dark=standard(0x293237);
  let width=7,depth=1.2,height=3.5,type=kind;
  if(kind==="communal_table"){
    width=7;depth=2.8;height=1.1;group.add(box(width,.22,depth,wood,0,.75,0));
    for(const x of [-2.6,2.6])group.add(box(.25,.75,1.8,dark,x,0,0));
  }else if(kind==="hearth"){
    width=5;depth=1.4;height=4;group.add(box(width,height,depth,standard(0x806b5d)));
    const opening=box(2.4,1.8,.18,dark,0,.15,-depth/2-.1);group.add(opening);
    const glow=new THREE.PointLight(0xff7937,28,9);glow.position.set(0,1,-1);group.add(glow);
  }else if(kind==="display_piece"){
    width=4;depth=4;height=5;group.add(box(2,.8,2,standard(0xd8d3c7)));
    const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(1.15,.34,60,10),accent);sculpture.position.y=2.6;sculpture.castShadow=true;group.add(sculpture);
  }else if(kind==="service_station"){
    width=7;depth=2.4;height=1.45;group.add(box(width,1.15,depth,wood),box(width,.16,.55,accent,0,1.1,-depth/2));
  }else{
    type="teaching_wall";width=8;depth=.35;height=3.6;group.add(box(width,height,depth,standard(0xd8d6ca)),box(width*.88,height*.72,.08,dark,0,.42,depth/2+.05));
  }
  return {group,width,depth,height,type};
}

function createInterior(spec,random){
  const plan=spec.world||{},kind=plan.archetype||"office",palette=interiorPalettes[kind]||interiorPalettes.office;
  const dimensions={spacious:[32,24],furnished:[38,28],busy:[44,32]}[plan.density]||[38,28];
  const width=dimensions[0]+Math.floor(random()*3)*2,depth=dimensions[1]+Math.floor(random()*3)*2,wallHeight=6.2;
  const group=new THREE.Group();group.name="interior-scene-pack";
  const groundGroup=new THREE.Group();groundGroup.name="interior-shell";group.add(groundGroup);
  const floor=box(width,.22,depth,standard(palette.floor));floor.position.y=-.11;floor.receiveShadow=true;groundGroup.add(floor);
  const items=[];
  const addSolid=(model,type,category,x,z,w,d,h,index=0)=>{model.position.x=x;model.position.z=z;group.add(model);items.push(item(model,type,category,x,z,w,d,h,index));};
  const wallMaterial=standard(palette.wall),back=box(width,wallHeight,.28,wallMaterial,0,0,-depth/2),left=box(.28,wallHeight,depth,wallMaterial,-width/2,0,0),right=box(.28,wallHeight,depth,wallMaterial,width/2,0,0);
  for(const [index,[model,type,x,z,w,d]] of [[back,"back_wall",0,-depth/2,width,.28],[left,"side_wall",-width/2,0,.28,depth],[right,"side_wall",width/2,0,.28,depth]].entries()){
    groundGroup.add(model);items.push(item(model,type,"architecture",x,z,w,d,wallHeight,index));
  }
  if(plan.feature==="window_wall"){
    const glass=standard(0x8fc2cf,{transparent:true,opacity:.44,roughness:.18});
    for(let x=-width*.38;x<=width*.38;x+=width*.19){const window=box(width*.15,2.7,.06,glass,x,2.2,-depth/2+.18);groundGroup.add(window);}
  }else if(plan.feature==="skylights"){
    for(const x of [-width*.2,width*.2]){const frame=box(width*.22,.12,depth*.3,standard(0xb5ced2),x,wallHeight,0);groundGroup.add(frame);}
  }else if(plan.feature==="mezzanine"){
    const deck=box(width*.55,.35,depth*.22,standard(palette.furniture),0,3.8,-depth*.34);addSolid(deck,"mezzanine","architecture",0,-depth*.34,width*.55,depth*.22,.35);
  }else{
    const feature=box(width*.68,wallHeight*.72,.18,standard(palette.accent),0,.55,-depth/2+.17);groundGroup.add(feature);
  }

  if(plan.topology==="split_zones"){
    const divider=box(.24,3.5,depth*.52,wallMaterial,0,0,-depth*.02);addSolid(divider,"partition","architecture",0,-depth*.02,.24,depth*.52,3.5);
  }else if(plan.topology==="perimeter_rooms"){
    for(const side of [-1,1]){const partition=box(width*.22,3.5,.22,wallMaterial,side*width*.28,0,-depth*.18);addSolid(partition,"partition","architecture",side*width*.28,-depth*.18,width*.22,.22,3.5,side+1);}
  }

  const count={spacious:7,furnished:12,busy:18}[plan.density]||12;
  const columns=plan.topology==="central_aisle"?2:plan.topology==="split_zones"?4:Math.max(3,Math.round(Math.sqrt(count*width/depth)));
  for(let index=0;index<count;index++){
    const station=interiorStation(kind,index,random,palette),col=index%columns,row=Math.floor(index/columns);
    let x=(col-(columns-1)/2)*(width*.72/Math.max(1,columns-1)),z=-depth*.25+row*(depth*.52/Math.max(1,Math.ceil(count/columns)-1));
    if(plan.topology==="central_aisle")x=(col?1:-1)*width*.22;
    if(plan.topology==="open_plan"){x+=(random()-.5)*1.8;z+=(random()-.5)*1.4;}
    addSolid(station.group,station.type,"decor",x,z,station.width,station.depth,station.height,index);
  }
  const landmark=interiorLandmark(plan.landmark||"communal_table",palette);
  const landmarkZ=["teaching_wall","hearth"].includes(landmark.type)?-depth*.39:landmark.type==="display_piece"?0:depth*.28;
  addSolid(landmark.group,landmark.type,"landmark",0,landmarkZ,landmark.width,landmark.depth,landmark.height);

  const peopleCount={empty:0,quiet:3,active:7,crowded:12}[plan.population]||0;
  for(let index=0;index<peopleCount;index++){
    const person=new THREE.Group(),body=cylinder(.24,.3,1.15,standard(index%2?palette.accent:0x536779));person.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),standard([0x8d5524,0xc68642,0xe0ac69,0xf1c27d][index%4]));head.position.y=1.55;head.castShadow=true;person.add(head);
    const x=(random()-.5)*width*.72,z=(random()-.5)*depth*.55;person.position.set(x,.12,z);group.add(person);items.push(item(person,"occupant","people",x,z,.65,.65,1.8,index));
  }
  const lightCount=plan.hazard==="after_hours"?3:6;
  for(let index=0;index<lightCount;index++){
    const light=new THREE.PointLight(plan.hazard==="emergency"?0xff4b35:0xfff0cf,plan.hazard==="after_hours"?18:34,18,2);
    light.position.set((index%3-1)*width*.25,wallHeight-.35,(Math.floor(index/3)-.5)*depth*.42);group.add(light);
  }
  const heightAt=()=>.12,landscape=landscapeContract(groundGroup,heightAt,Math.max(width,depth));
  const layout={items,landRadius:Math.min(width,depth)*.48,sceneExtent:Math.max(width,depth),largeWorld:true,avatarScale:.9,cameraTargetY:2.2,cameraProfile:"interior",worldFamily:"interior",roomBounds:{width,depth}};
  group.userData.worldStats={family:"interior",room:kind,topology:plan.topology,width,depth,stations:count,occupants:peopleCount,feature:plan.feature};
  return {group,landscape,layout,stats:group.userData.worldStats};
}

export function createLargeWorld(spec,random=Math.random){
  if(spec.scenePack==="ocean_liner")return createOceanLiner(spec,random);
  if(spec.scenePack==="prehistoric")return createPrehistoric(spec,random);
  if(spec.scenePack==="medieval_city")return createMedievalCity(spec,random);
  if(spec.scenePack==="interior")return createInterior(spec,random);
  throw new Error("Unsupported large world family: "+spec.scenePack);
}
