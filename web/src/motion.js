import * as THREE from "three";

const vehicles=new Set(["car","race_car","bus","truck","tram","motorcycle","bicycle"]);
const walkers=new Set(["person","man","woman","elder","child","boy","girl","occupant"]);
const roamingAnimals=new Set(["dog","cat","horse","cow","sheep","deer","trex","raptor","triceratops","sauropod"]);
const flying=new Set(["bird","eagle","kite"]);

export function motionKind(type){
  if(flying.has(type))return "flying";
  if(vehicles.has(type))return "vehicle";
  if(walkers.has(type)||roamingAnimals.has(type))return "walker";
  return null;
}

function unit(seed){
  let value=2166136261;
  for(const character of seed)value=Math.imul(value^character.charCodeAt(0),16777619);
  value^=value>>>16;return (value>>>0)/4294967296;
}

function boundsFor(layout,item){
  if(layout.worldFamily==="ocean_liner")return {minX:-48,maxX:48,minZ:-7,maxZ:7};
  if(layout.roomBounds)return {minX:-layout.roomBounds.width/2+1,maxX:layout.roomBounds.width/2-1,minZ:-layout.roomBounds.depth/2+1,maxZ:layout.roomBounds.depth/2-1};
  const limit=Math.max(8,layout.landRadius*.82);
  return {minX:-limit,maxX:limit,minZ:-limit,maxZ:limit,radial:limit-item.width*.5};
}

function blocked(item,x,z,layout){
  const bounds=boundsFor(layout,item);
  if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||(bounds.radial&&Math.hypot(x,z)>bounds.radial))return true;
  const pad=item.motion?.kind==="vehicle"?.2:.08;
  return layout.items.some(other=>other!==item&&other.collidable!==false&&
    !(item.motion?.kind==="walker"&&["people","animal"].includes(other.group))&&
    Math.abs(x-other.x)<(item.width+other.width)/2+pad&&Math.abs(z-other.z)<(item.depth+other.depth)/2+pad);
}

function initialize(item,layout,variant){
  if(item.motion)return item.motion;
  const baseKind=motionKind(item.type);if(!baseKind)return null;
  const key=`${variant}|${item.type}|${item.index}|${item.x.toFixed(2)}|${item.z.toFixed(2)}`;
  const pick=unit(key);
  if(baseKind==="vehicle"&&pick<.2)return null;
  if(baseKind==="walker"&&pick<.34)return null;
  const wings=[];item.model.traverse(node=>{if(node.userData.flightWing)wings.push(node);});
  const track=item.type==="race_car"?layout.items.find(entry=>entry.type==="race_track"):null;
  if(track){
    item.motion={kind:"track",centerX:track.x,centerZ:track.z,radius:Math.hypot(item.x-track.x,item.z-track.z),angle:Math.atan2(item.z-track.z,item.x-track.x),speed:.28+pick*.18,wings};
  }else if(baseKind==="flying"){
    item.motion={kind:"flying",centerX:item.x,centerZ:item.z,radius:2.2+unit(key+"r")*3.8,angle:unit(key+"a")*Math.PI*2,
      speed:(item.type==="kite"?.16:.28)+unit(key+"s")*.18,direction:unit(key+"d")>.5?1:-1,wings};
  }else{
    const modelHeading=item.model.rotation.y+(baseKind==="vehicle"?Math.PI/2:0);
    item.motion={kind:baseKind,heading:modelHeading+(pick-.5)*.5,speed:baseKind==="vehicle"?1.7+unit(key+"s")*2.1:.35+unit(key+"s")*.55,
      turnIn:.8+unit(key+"t")*3.2,phase:unit(key+"p")*Math.PI*2,wings};
  }
  return item.motion;
}

function baseY(item,heightAt){return heightAt(item.x,item.z)+.008+(item.elevationOffset??item.flightHeight??0);}

function setPose(item,heightAt,elapsed,bob=0){
  item.model.position.set(item.x,baseY(item,heightAt)+bob,item.z);
  item.model.updateMatrixWorld(true);
  const motion=item.motion;
  for(const wing of motion.wings||[])wing.rotation.x=Math.sin(elapsed*(item.type==="eagle"?4.2:7.5)+motion.phase)*(item.type==="eagle"?.28:.48)*wing.userData.flightWing;
}

export function advanceSceneMotion(layout,heightAt,variant,delta,elapsed){
  if(!layout?.items||!heightAt)return 0;
  let moving=0;
  for(const item of layout.items){
    const motion=initialize(item,layout,variant);if(!motion)continue;
    moving++;
    if(motion.kind==="flying"){
      motion.angle+=motion.speed*motion.direction*delta;
      item.x=motion.centerX+Math.cos(motion.angle)*motion.radius;
      item.z=motion.centerZ+Math.sin(motion.angle)*motion.radius;
      item.model.rotation.y=-motion.angle+(motion.direction>0?0:Math.PI);
      setPose(item,heightAt,elapsed,Math.sin(elapsed*1.7+motion.angle)*.22);
      continue;
    }
    if(motion.kind==="track"){
      motion.angle+=motion.speed*delta;
      item.x=motion.centerX+Math.cos(motion.angle)*motion.radius;
      item.z=motion.centerZ+Math.sin(motion.angle)*motion.radius;
      item.model.rotation.y=motion.angle+Math.PI/2;
      setPose(item,heightAt,elapsed);
      continue;
    }
    motion.turnIn-=delta;
    if(motion.kind==="walker"&&motion.turnIn<=0){
      motion.heading+=(unit(`${variant}|turn|${item.type}|${item.index}|${Math.floor(elapsed/2)}`)-.5)*1.35;
      motion.turnIn=1.8+unit(`${item.type}|${elapsed}`)*3.8;
    }
    const dx=Math.sin(motion.heading)*motion.speed*delta,dz=Math.cos(motion.heading)*motion.speed*delta;
    if(blocked(item,item.x+dx,item.z+dz,layout)){
      motion.heading+=1.15+unit(`${item.type}|bounce|${Math.floor(elapsed*3)}`)*1.4;
      motion.turnIn=.7;
    }else{item.x+=dx;item.z+=dz;}
    item.model.rotation.y=motion.heading-(motion.kind==="vehicle"?Math.PI/2:0);
    motion.phase+=delta*motion.speed*(motion.kind==="vehicle"?2:9);
    setPose(item,heightAt,elapsed,motion.kind==="walker"?Math.abs(Math.sin(motion.phase))*.035:0);
  }
  return moving;
}

export function advanceTrafficMotion(mesh,delta){
  const motion=mesh?.userData?.trafficMotion;if(!motion)return 0;
  const dummy=motion.dummy||(motion.dummy=new THREE.Object3D()),limit=motion.extent*.48;
  for(let index=0;index<motion.states.length;index++){
    const state=motion.states[index];state.along+=state.direction*state.speed*delta;
    if(state.along>limit)state.along=-limit;else if(state.along< -limit)state.along=limit;
    const x=state.horizontal?state.along:state.road,z=state.horizontal?state.road:state.along;
    dummy.position.set(x,.34,z);dummy.rotation.y=state.horizontal?0:Math.PI/2;dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    dummy.position.y=.77;dummy.updateMatrix();motion.roofs.setMatrixAt(index,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;motion.roofs.instanceMatrix.needsUpdate=true;
  return motion.states.length;
}
