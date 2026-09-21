const people = new Set(["people", "animal"]);
const waterLife = new Set(["boat","fishing_boat","ship","submarine","buoy","fish","iceberg"]);
const groundWater = new Set(["pond","river","fountain"]);

export function intersects(a,b,gap=.2) {
  return Math.abs(a.x-b.x)<(a.width+b.width)/2+gap &&
    Math.abs(a.z-b.z)<(a.depth+b.depth)/2+gap;
}

// Pack additions around current, possibly edited coordinates. Never relayout old items.
export function appendLayout(items, current, spec, random) {
  const placed = [...current.items], added = [];
  const coastal = ["ocean","coast"].includes(spec.environment);
  for (const item of items) {
    let anchor = placed.find(p => p.type === item.anchor);
    if (!anchor && ["bridge","lotus",...waterLife].includes(item.type)) anchor = placed.find(p => ["pond","river"].includes(p.type));
    const afloat = coastal && waterLife.has(item.type);
    const waterShare = other => other === anchor && groundWater.has(other.type) && ["bridge","lotus",...waterLife].includes(item.type);
    const distance = anchor ? (Math.hypot(anchor.width,anchor.depth)+Math.hypot(item.width,item.depth))/2 + .8 : current.landRadius*.45;
    const angles = {left:-Math.PI/2,right:Math.PI/2,foreground:0,background:Math.PI};
    const angle = angles[item.placement] ?? (item.index/Math.max(1,item.count)*Math.PI*2 + random()*.5);
    let desired = {x:(anchor?.x??0)+Math.sin(angle)*distance,z:(anchor?.z??0)+Math.cos(angle)*distance};
    if (anchor && waterShare(anchor)) desired = {x:anchor.x,z:anchor.z};
    if (!anchor && item.placement === "center") desired = {x:0,z:0};
    if (afloat) { const r=current.landRadius+Math.hypot(item.width,item.depth)/2+3; desired={x:Math.sin(angle)*r,z:Math.cos(angle)*r}; }
    let best = null;
    for (let attempt=0;attempt<2400;attempt++) {
      const radius=Math.sqrt(attempt)*.65, a=attempt*2.399;
      const candidate={...item,x:desired.x+Math.sin(a)*radius,z:desired.z+Math.cos(a)*radius};
      const dx=candidate.x-(anchor?.x??0), dz=candidate.z-(anchor?.z??0);
      if ((item.placement==="left"&&dx>=0)||(item.placement==="right"&&dx<=0)||
          (item.placement==="foreground"&&dz<=0)||(item.placement==="background"&&dz>=0)) continue;
      if (placed.some(other=>!waterShare(other)&&intersects(candidate,other,.3))) continue;
      const d=Math.hypot(candidate.x,candidate.z),margin=Math.hypot(item.width,item.depth)/2;
      if (coastal && (afloat ? d<current.landRadius+margin+1 : d+margin>current.landRadius-.5)) continue;
      if (spec.environment==="city" && item.group!=="vehicle" && Math.abs(candidate.z-(current.roadZ??1))<candidate.depth/2+1.8) continue;
      best=candidate;break;
    }
    if (!best) throw new Error("No clear space for these additions. Move objects apart or add fewer objects.");
    if (anchor && (["tent","chair"].includes(item.type) || item.group === "people"))
      best.facing=Math.atan2(anchor.x-best.x,anchor.z-best.z);
    placed.push(best);added.push(best);
  }
  return added;
}

// Deterministic, bounded packing with semantic zones. Explicit directions win.
export function planLayout(items,spec,random) {
  const coastal=["ocean","coast"].includes(spec.environment);
  const urban=spec.environment==="city";
  const occupiedArea=items.reduce((s,i)=>s+(i.width+.6)*(i.depth+.6),0);
  const extent=Math.max(9,Math.sqrt(occupiedArea)*.72);
  const railway=urban&&items.some(i=>i.type==="train");
  const roadZ=railway?extent*.6:1;
  const priority=item => groundWater.has(item.type)?0:item.type==="campfire"?1:
    item.group==="architecture"||item.group==="landmark"||item.type==="tent"?2:
    item.group==="terrain"?3:item.group==="vehicle"?4:
    ["table","picnic_table"].includes(item.type)?5:item.group==="flora"?7:people.has(item.group)?8:6;
  const sorted=[...items].sort((a,b)=>priority(a)-priority(b)||b.height-a.height);
  const placed=[];
  let buildingIndex=0,personIndex=0,plantIndex=0;
  const semanticPosition=item=>{
    const {group,type,index,count}=item;
    if(groundWater.has(type))return {x:urban?extent*.4:extent*.7,z:urban?extent*.45:-extent*.22};
    const fire=placed.find(p=>p.type==="campfire");
    const water=placed.find(p=>p.type==="pond"||p.type==="river");
    if(type==="campfire")return {x:water?-extent*.3:0,z:1};
    if(type==="tent" && fire){
      const angle=Math.PI*.95+index/Math.max(1,count-1)*Math.PI*.95;
      const radius=3.3+Math.max(item.width,item.depth)*.55;
      return{x:fire.x+Math.cos(angle)*radius,z:fire.z+Math.sin(angle)*radius};
    }
    if(type==="chair"){
      const table=placed.find(p=>p.type==="table");
      const anchor=fire||table;
      if(anchor){const a=.3+index/Math.max(1,count)*Math.PI*2,r=fire?2.2:Math.max(anchor.width,anchor.depth)*.6+.6;
        return{x:anchor.x+Math.sin(a)*r,z:anchor.z+Math.cos(a)*r};}
    }
    if(type==="lantern"){
      const tents=placed.filter(p=>p.type==="tent");const anchor=tents[index%Math.max(1,tents.length)];
      if(anchor)return{x:anchor.x+anchor.width*.6,z:anchor.z+anchor.depth*.6};
    }
    if(type==="bridge") {
      const water=placed.find(p=>p.type==="pond"||p.type==="river");
      if(water) return {x:water.x,z:water.z};
    }
    if(type==="lotus"){
      const water=placed.find(p=>p.type==="pond");
      if(water)return{x:water.x+(random()-.5)*water.width*.5,z:water.z+(random()-.5)*water.depth*.5};
    }
    if(type==="dock" && water)return{x:water.x,z:water.z+water.depth*.5+item.depth*.35};
    if(type==="station")return {x:-extent*.25,z:-2.7};
    if(type==="train")return {x:-extent*.2,z:.3};
    if(group==="architecture"||group==="landmark"){
      const i=buildingIndex++;
      if(urban)return{x:(i%4-1.5)*extent*.42,z:-extent*.48-Math.floor(i/4)*3.5};
      const a=(i*.9+Math.PI)*1.2;
      return{x:Math.cos(a)*extent*.5,z:Math.sin(a)*extent*.42-1.5};
    }
    if(group==="terrain"&&item.height>3)return{x:(index-(count-1)/2)*4,z:-extent*.8};
    if(group==="vehicle")return{x:(index-(count-1)/2)*3,z:roadZ};
    if(group==="air")return{x:extent*.5,z:-extent*.4};
    if(people.has(group)){
      const i=personIndex++;
      const hosts=placed.filter(p=>["campfire","picnic_table","cafe","shop","fountain","barn"].includes(p.type));
      if(hosts.length){const host=hosts[i%hosts.length];
        return{x:host.x+(i%2?1:-1)*(host.width*.5+.7),z:host.z+host.depth*.5+1+Math.floor(i/hosts.length)*.65};}
      // Small figures must sit in front of stalls/buildings, not just avoid
      // their ground footprint: a tall object can still hide them in projection.
      const front=Math.max(extent*.35,...placed.filter(p=>!people.has(p.group)).map(p=>p.z+p.depth/2));
      return{x:-extent*.15+(i%6)*.9,z:front+.8+Math.floor(i/6)*1.1};
    }
    if(group==="flora"){
      const i=plantIndex++;
      const radius=extent*(.5+random()*.24);
      // Tall vegetation frames the scene from behind; it must not screen the
      // activity area from the default camera on the positive-Z side.
      if(item.height>2){
        const total=items.filter(p=>p.group==="flora"&&p.height>2).length;
        const a=Math.PI+.18+(i/Math.max(1,total-1))*(Math.PI-.36);
        return{x:Math.cos(a)*radius,z:Math.sin(a)*radius-2};
      }
      const a=i*2.399;
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
    const hasActivityAnchor=["tent","chair","lantern"].includes(item.type)&&placed.some(p=>p.type==="campfire"||p.type==="table");
    if(placement==="around"&&!hasActivityAnchor){const a=item.index/Math.max(1,item.count)*Math.PI*2;desired={x:Math.cos(a)*extent*.6,z:Math.sin(a)*extent*.6};}
    const waterBound=coastal&&waterLife.has(item.type);
    if(waterBound){const a=.25+item.index/Math.max(1,item.count)*Math.PI;desired={x:Math.cos(a)*(extent+4+item.width/2),z:Math.sin(a)*(extent+4+item.depth/2)};}
    const canShare=(other)=>["bridge","lotus","dock"].includes(item.type)&&["pond","river"].includes(other.type);
    let best=null,bestScore=Infinity;
    for(let attempt=0;attempt<420;attempt++){
      const a=attempt*2.399, radius=attempt?Math.sqrt(attempt)*.7:0;
      const candidate={...item,x:desired.x+Math.cos(a)*radius,z:desired.z+Math.sin(a)*radius};
      if(placed.some(other=>!canShare(other)&&intersects(candidate,other,people.has(item.group)?.12:.35)))continue;
      if(waterBound&&Math.hypot(candidate.x,candidate.z)<extent+Math.hypot(item.width,item.depth)/2+1)continue;
      // Keep the urban transport corridor legible.
      if(urban && item.group!=="vehicle" && Math.abs(candidate.z-roadZ)<candidate.depth/2+1.8)continue;
      if(railway && !["train","station"].includes(item.type) && Math.abs(candidate.z-.3)<candidate.depth/2+1.2)continue;
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
  for(const item of placed){
    const target = ["tent","chair"].includes(item.type)
      ? placed.find(p=>p.type==="campfire") || placed.find(p=>p.type==="table")
      : item.group==="people" ? placed.filter(p=>["campfire","fountain","table","picnic_table"].includes(p.type))
        .sort((a,b)=>Math.hypot(a.x-item.x,a.z-item.z)-Math.hypot(b.x-item.x,b.z-item.z))[0] : null;
    if(target)item.facing=Math.atan2(target.x-item.x,target.z-item.z);
  }
  const land=placed.filter(p=>!waterLife.has(p.type));
  const landRadius=Math.max(extent+1,...land.map(p=>Math.hypot(p.x,p.z)+Math.hypot(p.width,p.depth)/2+.8));
  // Marine objects stay outside the final shoreline even after land packing expands.
  if(coastal)for(const item of placed.filter(p=>waterLife.has(p.type))){
    const r=Math.hypot(item.x,item.z), target=landRadius+Math.hypot(item.width,item.depth)/2+2;
    if(r<target){item.x*=target/Math.max(r,.01);item.z*=target/Math.max(r,.01);}
  }
  return {items:placed,landRadius,roadZ};
}
