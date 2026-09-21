const people = new Set(["people", "animal"]);
const waterLife = new Set(["boat","fishing_boat","ship","submarine","buoy","fish","iceberg"]);
const groundWater = new Set(["pond","river","fountain"]);

export function intersects(a,b,gap=.2) {
  return Math.abs(a.x-b.x)<(a.width+b.width)/2+gap &&
    Math.abs(a.z-b.z)<(a.depth+b.depth)/2+gap;
}

// Deterministic, bounded packing with semantic zones. Explicit directions win.
export function planLayout(items,spec,random) {
  const coastal=["ocean","coast"].includes(spec.environment);
  const urban=spec.environment==="city";
  const occupiedArea=items.reduce((s,i)=>s+(i.width+.6)*(i.depth+.6),0);
  const extent=Math.max(9,Math.sqrt(occupiedArea)*.72);
  const priority=item => groundWater.has(item.type)?0:
    item.group==="architecture"||item.group==="landmark"?1:
    item.group==="terrain"?2:item.group==="vehicle"?3:item.group==="flora"?4:people.has(item.group)?6:5;
  const sorted=[...items].sort((a,b)=>priority(a)-priority(b)||b.height-a.height);
  const placed=[];
  let buildingIndex=0,personIndex=0,plantIndex=0;
  const semanticPosition=item=>{
    const {group,type,index,count}=item;
    if(groundWater.has(type))return {x:urban?extent*.4:extent*.25,z:urban?extent*.45:1};
    if(type==="bridge") {
      const water=placed.find(p=>p.type==="pond"||p.type==="river");
      if(water) return {x:water.x,z:water.z};
    }
    if(type==="lotus"){
      const water=placed.find(p=>p.type==="pond");
      if(water)return{x:water.x+(random()-.5)*water.width*.5,z:water.z+(random()-.5)*water.depth*.5};
    }
    if(type==="station")return {x:-extent*.25,z:-2.7};
    if(type==="train")return {x:-extent*.2,z:.3};
    if(group==="architecture"||group==="landmark"){
      const i=buildingIndex++;
      if(urban)return{x:(i%4-1.5)*extent*.42,z:-extent*.48-Math.floor(i/4)*3.5};
      const a=(i*.9+Math.PI)*1.2;
      return{x:Math.cos(a)*extent*.5,z:Math.sin(a)*extent*.42-1.5};
    }
    if(group==="terrain"&&item.height>3)return{x:(index-(count-1)/2)*4,z:-extent*.8};
    if(group==="vehicle")return{x:(index-(count-1)/2)*3,z:1};
    if(group==="air")return{x:extent*.5,z:-extent*.4};
    if(people.has(group)){
      const i=personIndex++;
      // Small figures must sit in front of stalls/buildings, not just avoid
      // their ground footprint: a tall object can still hide them in projection.
      const front=Math.max(extent*.35,...placed.filter(p=>!people.has(p.group)).map(p=>p.z+p.depth/2));
      return{x:-extent*.15+(i%6)*.9,z:front+.8+Math.floor(i/6)*1.1};
    }
    if(group==="flora"){
      const a=plantIndex++*2.399;
      const radius=extent*(.5+random()*.24);
      return{x:Math.cos(a)*radius,z:Math.sin(a)*radius};
    }
    if(type==="table"||type==="chair"||type==="bench"||type==="picnic_table"){
      const anchor=placed.find(p=>["cafe","house","cabin","tent","pavilion"].includes(p.type));
      if(anchor)return{x:anchor.x+anchor.width*.65+1,z:anchor.z+anchor.depth*.6+1};
    }
    if(group==="camp"){
      if(type==="campfire")return{x:0,z:2};
      const a=index*2.4+.5;return{x:Math.cos(a)*4,z:Math.sin(a)*3};
    }
    return{x:(random()-.5)*extent,z:2+(random()-.5)*extent*.5};
  };
  for(const item of sorted){
    let desired=semanticPosition(item);
    const placement=item.placement;
    const spread=(item.index-(item.count-1)/2)*Math.min(2.5,extent*1.4/Math.max(1,item.count));
    if(placement==="left")desired={x:-extent*.6,z:spread};
    if(placement==="right")desired={x:extent*.6,z:spread};
    if(placement==="foreground")desired={x:spread,z:extent*.6};
    if(placement==="background")desired={x:spread,z:-extent*.7};
    if(placement==="center")desired={x:spread*.6,z:0};
    if(placement==="around"){const a=item.index/Math.max(1,item.count)*Math.PI*2;desired={x:Math.cos(a)*extent*.6,z:Math.sin(a)*extent*.6};}
    const waterBound=coastal&&waterLife.has(item.type);
    if(waterBound){const a=.25+item.index/Math.max(1,item.count)*Math.PI;desired={x:Math.cos(a)*(extent+4+item.width/2),z:Math.sin(a)*(extent+4+item.depth/2)};}
    const canShare=(other)=>["bridge","lotus"].includes(item.type)&&["pond","river"].includes(other.type);
    let best=null,bestScore=Infinity;
    for(let attempt=0;attempt<420;attempt++){
      const a=attempt*2.399, radius=attempt?Math.sqrt(attempt)*.7:0;
      const candidate={...item,x:desired.x+Math.cos(a)*radius,z:desired.z+Math.sin(a)*radius};
      if(placed.some(other=>!canShare(other)&&intersects(candidate,other,people.has(item.group)?.12:.35)))continue;
      if(waterBound&&Math.hypot(candidate.x,candidate.z)<extent+Math.hypot(item.width,item.depth)/2+1)continue;
      // Keep the urban transport corridor legible.
      if(urban && item.group!=="vehicle" && Math.abs(candidate.z-1)<candidate.depth/2+1.4)continue;
      const score=radius+Math.hypot(candidate.x,candidate.z)*.04;
      if(score<bestScore){best=candidate;bestScore=score;}
      if(best&&attempt>36)break;
    }
    // Guaranteed non-overlapping fallback, never silently drop an object.
    if(!best){
      const edge=Math.max(extent,...placed.map(p=>p.x+p.width/2));
      best={...item,x:edge+item.width/2+1,z:desired.z};
    }
    placed.push(best);
  }
  const land=placed.filter(p=>!waterLife.has(p.type));
  const landRadius=Math.max(extent+1,...land.map(p=>Math.hypot(p.x,p.z)+Math.hypot(p.width,p.depth)/2+.8));
  // Marine objects stay outside the final shoreline even after land packing expands.
  if(coastal)for(const item of placed.filter(p=>waterLife.has(p.type))){
    const r=Math.hypot(item.x,item.z), target=landRadius+Math.hypot(item.width,item.depth)/2+2;
    if(r<target){item.x*=target/Math.max(r,.01);item.z*=target/Math.max(r,.01);}
  }
  return {items:placed,landRadius};
}
