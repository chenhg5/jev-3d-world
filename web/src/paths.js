const entrances = new Set(["tent","cabin","house","pavilion","hall","shop","cafe","barn","station","picnic_table"]);

// Route on walkable cells; never draw a shortcut through a pond or a building.
export function routePath(start, end, obstacles, limit) {
  const step=.7, key=(x,z)=>`${x},${z}`;
  const blocked=(x,z)=>Math.abs(x*step)>limit||Math.abs(z*step)>limit||obstacles.some(o=>
    Math.abs(x*step-o.x)<o.width/2+.35&&Math.abs(z*step-o.z)<o.depth/2+.35);
  const freePoint=p=>{
    const x=Math.round(p.x/step),z=Math.round(p.z/step);
    for(let r=0;r<=5;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
      if(!blocked(x+dx,z+dz))return [x+dx,z+dz];
    }
    return [x,z];
  };
  const [sx,sz]=freePoint(start),[ex,ez]=freePoint(end);
  if(blocked(sx,sz)||blocked(ex,ez))return [];
  const open=[{x:sx,z:sz,g:0,f:0}],costs=new Map([[key(sx,sz),0]]),parents=new Map();
  for(let n=0;open.length&&n<16000;n++){
    open.sort((a,b)=>b.f-a.f);const current=open.pop(),k=key(current.x,current.z);
    if(current.g>costs.get(k))continue;
    if(current.x===ex&&current.z===ez){
      const result=[];let cursor=k;
      while(cursor){const [x,z]=cursor.split(",").map(Number);result.push({x:x*step,z:z*step});cursor=parents.get(cursor);}
      return result.reverse();
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=current.x+dx,z=current.z+dz;
      if(blocked(x,z)||(dx&&dz&&(blocked(x,current.z)||blocked(current.x,z))))continue;
      const nk=key(x,z),g=current.g+Math.hypot(dx,dz);
      if(g>=(costs.get(nk)??Infinity))continue;
      costs.set(nk,g);parents.set(nk,k);open.push({x,z,g,f:g+Math.hypot(ex-x,ez-z)});
    }
  }
  return [];
}

export function planPaths(layout) {
  const nodes=layout.items.filter(i=>entrances.has(i.type)).map(i=>{
    const a=i.facing??0,r=Math.hypot(i.width,i.depth)/2+1;
    return{x:i.x+Math.sin(a)*r,z:i.z+Math.cos(a)*r};
  });
  const fire=layout.items.find(i=>i.type==="campfire");
  if(fire)nodes.unshift({x:fire.x,z:fire.z+1.8});
  const obstacles=layout.items.filter(i=>!['people','animal'].includes(i.group));
  if(nodes.length<2)return [];
  const paths=[],connected=[nodes.shift()];
  while(nodes.length){
    let best={d:Infinity};
    nodes.forEach((n,index)=>connected.forEach(p=>{const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<best.d)best={d,index,n,p};}));
    const path=routePath(best.n,best.p,obstacles,layout.landRadius*1.8);
    if(path.length)paths.push(path);
    connected.push(nodes.splice(best.index,1)[0]);
  }
  return paths;
}
