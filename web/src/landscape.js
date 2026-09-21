import * as THREE from "three";
import {planPaths} from "./paths.js";

const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function objectElevation(item,spec,heightAt) {
  const afloat=["ocean","coast"].includes(spec.environment)&&["boat","fishing_boat","ship","submarine","buoy","fish","iceberg"].includes(item.type);
  return afloat?-.42:heightAt(item.x,item.z)+.008;
}
export function terrainSampler(spec,layout) {
  const r=layout.landRadius,coastal=["ocean","coast"].includes(spec.environment);
  return (x,z)=>{
    if(spec.preview||spec.environment==="city")return -.035;
    const d=Math.hypot(x,z),rise=smooth(r+2,r+22,d);
    const wave=Math.sin(x*.075+1.4)*Math.cos(z*.055)+Math.sin(x*.031-z*.07)*.65;
    if(coastal){const edge=r-.5+Math.sin(Math.atan2(z,x)*5)*.2;return -.035-smooth(edge,edge+1.7,d)*2.5;}
    const hills=(2.6+wave*2)*rise;
    const ridge=smooth(r+26,r+75,d)*(6+Math.pow(Math.sin(x*.025+z*.018),2)*15);
    return -.035+hills+ridge;
  };
}

export function createLandscape(spec,layout,baseColor,random) {
  const group=new THREE.Group();group.name="continuous-landscape";
  const heightAt=terrainSampler(spec,layout),r=layout.landRadius;
  const extent=Math.max(180,r*5),geometry=new THREE.PlaneGeometry(extent*2,extent*2,192,192);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position,colors=[];
  const base=new THREE.Color(baseColor),light=new THREE.Color(spec.environment==="snow"?0xeaf0f3:0x9ba373);
  for(let i=0;i<positions.count;i++){
    // Concentrate vertices around the inhabited area and shoreline, leaving
    // progressively larger cells for distant terrain hidden by atmospheric fog.
    const warp=v=>extent*Math.sinh(v/extent*3)/Math.sinh(3);
    const x=warp(positions.getX(i)),z=warp(positions.getZ(i)),y=heightAt(x,z);
    positions.setXYZ(i,x,y,z);
    const patch=(Math.sin(x*.12)*Math.sin(z*.13)+Math.sin(x*.037+z*.068))*.055;
    const color=base.clone().lerp(light,Math.max(0,patch+.08+Math.min(y/130,.18)));
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  ground.visible=!(spec.preview&&["ocean","coast"].includes(spec.environment));
  ground.receiveShadow=true;group.add(ground);

  const paths=spec.preview?[]:planPaths(layout);
  const blocked=(x,z,pad=.25)=>layout.items.some(i=>Math.abs(x-i.x)<i.width/2+pad&&Math.abs(z-i.z)<i.depth/2+pad);
  const onPath=(x,z)=>paths.some(p=>p.some(n=>Math.hypot(x-n.x,z-n.z)<.65));
  const pathGroup=createPathGroup(paths,heightAt,spec);group.add(pathGroup);

  if(spec.environment==="city"){
    const roadZ=layout.roadZ??1;
    const road=new THREE.Mesh(new THREE.PlaneGeometry(extent*2,3),new THREE.MeshStandardMaterial({color:0x39434a,roughness:.95}));
    road.rotation.x=-Math.PI/2;road.position.set(0,.005,roadZ);road.receiveShadow=true;group.add(road);
    for(const z of [roadZ-2.05,roadZ+2.05]){
      const walk=new THREE.Mesh(new THREE.BoxGeometry(extent*2,.09,.95),new THREE.MeshStandardMaterial({color:0xb2b1a4,roughness:1}));
      walk.position.set(0,.015,z);walk.receiveShadow=true;group.add(walk);
    }
    const marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.01,.06),new THREE.MeshStandardMaterial({color:0xe4d6ac}),100);
    const transform=new THREE.Object3D();for(let i=0;i<100;i++){transform.position.set((i-50)*2.4,.025,roadZ);transform.updateMatrix();marks.setMatrixAt(i,transform.matrix);}group.add(marks);
  }
  if(["ocean","coast"].includes(spec.environment)){
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(extent*2,extent*2),new THREE.MeshStandardMaterial({color:0x398d9c,roughness:.24,metalness:.25}));
    sea.rotation.x=-Math.PI/2;sea.position.y=-.42;group.add(sea);
  }

  if(!spec.preview&&["meadow","forest","garden"].includes(spec.environment)){
    const grassGeo=new THREE.BufferGeometry();
    grassGeo.setAttribute("position",new THREE.Float32BufferAttribute([-.04,0,0,.04,0,0,.04,.32,0,0,0,-.04,0,0,.04,0,.25,.05],3));
    grassGeo.computeVertexNormals();
    const grassCount=Math.min(8000,Math.max(650,Math.round(r*r*25*.65)));
    const grass=new THREE.InstancedMesh(grassGeo,new THREE.MeshStandardMaterial({color:0x91a56d,side:THREE.DoubleSide,roughness:1}),grassCount);
    const t=new THREE.Object3D();let n=0;
    for(let i=0;i<grassCount*2&&n<grassCount;i++){
      const x=(random()-.5)*r*5,z=(random()-.5)*r*5;
      if(blocked(x,z,.35)||onPath(x,z))continue;
      t.position.set(x,heightAt(x,z),z);t.rotation.y=random()*6.28;t.scale.setScalar(.65+random()*.65);t.updateMatrix();grass.setMatrixAt(n++,t.matrix);
    }
    grass.name="ground-cover";grass.count=n;grass.computeBoundingSphere();group.add(grass);
  }
  // Only free-form themes can add background trees; exact inventories stay exact.
  if(spec.scenery&&!spec.preview&&["forest","meadow","garden"].includes(spec.environment)&&layout.items.some(i=>["tree","pine","tent"].includes(i.type))){
    const count=140,t=new THREE.Object3D();
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.18,2,6),new THREE.MeshStandardMaterial({color:0x66513e}),count);
    const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(1.25,3,9),new THREE.MeshStandardMaterial({color:0x385d4b,roughness:1}),count*3);
    for(let i=0;i<count;i++){
      const a=random()*Math.PI*2,dist=r*1.7+random()*r*2.6,x=Math.cos(a)*dist,z=Math.sin(a)*dist,s=.7+random()*1.3,y=heightAt(x,z);
      t.rotation.set(0,a,0);t.scale.setScalar(s);t.position.set(x,y+s,z);t.updateMatrix();trunks.setMatrixAt(i,t.matrix);
      for(let j=0;j<3;j++){t.scale.set(s*(1-j*.17),s*(1-j*.13),s*(1-j*.17));t.position.set(x,y+s*(2+j*.8),z);t.updateMatrix();crowns.setMatrixAt(i*3+j,t.matrix);}
    }
    trunks.name="background-trunks";crowns.name="background-canopies";
    trunks.computeBoundingSphere();crowns.computeBoundingSphere();group.add(trunks,crowns);
  }
  return {group,heightAt,paths,extent,pathGroup};
}

function createPathGroup(paths,heightAt,spec) {
  const group=new THREE.Group();group.name="walking-paths";
  const pathMat=new THREE.MeshStandardMaterial({color:spec.environment==="garden"?0xb1ac95:0x9b8864,roughness:1});
  const vertices=[];
  for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],len=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.z-a.z)/len*.34,dz=-(b.x-a.x)/len*.34;
    const corners=[[a.x-dx,a.z-dz],[a.x+dx,a.z+dz],[b.x+dx,b.z+dz],[b.x-dx,b.z-dz]];
    for(const j of [0,2,1,0,3,2]){const [x,z]=corners[j];vertices.push(x,heightAt(x,z)+.028,z);}
  }
  if(vertices.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    const m=new THREE.Mesh(g,pathMat);m.receiveShadow=true;group.add(m);
    const joins=paths.flat(),rounds=new THREE.InstancedMesh(new THREE.CircleGeometry(.34,16),pathMat,joins.length),t=new THREE.Object3D();
    for(let i=0;i<joins.length;i++){t.position.set(joins[i].x,heightAt(joins[i].x,joins[i].z)+.027,joins[i].z);t.rotation.x=-Math.PI/2;t.updateMatrix();rounds.setMatrixAt(i,t.matrix);}
    rounds.receiveShadow=true;group.add(rounds);
  }else pathMat.dispose();

  return group;
}

export function refreshPaths(landscape,layout,spec) {
  landscape.group.remove(landscape.pathGroup);
  landscape.pathGroup.traverse(child=>{
    child.geometry?.dispose();
    child.material?.dispose();
    if(child.isInstancedMesh)child.dispose();
  });
  landscape.paths=spec.preview?[]:planPaths(layout);
  landscape.pathGroup=createPathGroup(landscape.paths,landscape.heightAt,spec);
  landscape.group.add(landscape.pathGroup);
}
