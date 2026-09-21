import * as THREE from "three";

// A small modelling vocabulary, shared by distinct silhouettes and assemblies.
// Units are normalized by catalog height after construction, before layout.
export function createLibraryAsset(type, {colors, random, mesh, material}) {
  const g = new THREE.Group();
  const brown = colors.wood, leaf = colors.leaf, stone = colors.stone;
  const cream = 0xe9dfc4, red = 0xb85f4b, dark = 0x364d52, glass = 0x8cc7cd;
  const add = (geo, color, x=0, y=0, z=0, options={}) => {
    const o=mesh(geo, material(color, options), x,y,z); g.add(o); return o;
  };
  const box=(w,h,d,c,x=0,y=h/2,z=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const cyl=(a,b,h,c,x=0,y=h/2,z=0,n=16)=>add(new THREE.CylinderGeometry(a,b,h,n),c,x,y,z);
  const ball=(r,c,x=0,y=r,z=0)=>add(new THREE.IcosahedronGeometry(r,1),c,x,y,z);
  const ring=(r,t,c,x=0,y=0,z=0)=>add(new THREE.TorusGeometry(r,t,8,24),c,x,y,z);
  const rod=(a,b,r,c)=>{
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), diff=end.clone().sub(start);
    const o=cyl(r,r,diff.length(),c); o.position.copy(start.add(end).multiplyScalar(.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize()); return o;
  };
  const roof=(w,d,y,c=red)=>{
    const shape=new THREE.Shape(); shape.moveTo(-w/2,0);shape.lineTo(0,w*.3);shape.lineTo(w/2,0);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});
    return add(geo,c,0,y,-d/2);
  };
  const windows=(w,h,d)=>{
    for(let y=.8;y<h-.2;y+=.65) for(let x=-w/2+.4;x<w/2-.15;x+=.65){
      for(const z of [-d/2-.02,d/2+.02]) box(.34,.4,.04,glass,x,y,z);
    }
  };
  const wheels=(length,width,r=.3)=>{
    for(const x of [-length*.32,length*.32])for(const z of [-width*.52,width*.52]){
      const w=cyl(r,r,.15,0x293b42,x,r,z,16);w.rotation.x=Math.PI/2;
      const hub=cyl(r*.5,r*.5,.16,0xbdc5bd,x,r,z,12);hub.rotation.x=Math.PI/2;
    }
  };
  const bench=(x=0,z=0)=>{
    for(const dx of [-.65,.65])box(.1,.45,.55,dark,x+dx,.225,z);
    for(const dz of [-.2,0,.2])box(1.7,.08,.16,brown,x,.5,z+dz);
    for(const y of [.72,.9])box(1.7,.12,.08,brown,x,y,z-.26);
  };
  const foliage=(x,y,z,r,c=leaf)=>{const o=ball(r,c,x,y,z);o.scale.y=.8+random()*.45;return o;};
  const chimney=(x,z,h)=>{cyl(.16,.23,h,red,x,h/2,z);cyl(.24,.24,.15,dark,x,h,z);};
  const house=(w=3,h=2,d=2.4)=>{
    box(w,h,d,cream);roof(w+.3,d+.3,h);windows(w,h,d);
    box(.58,1.1,.06,brown,0,.55,d/2+.04);
  };
  const wheelSpokes=(x,y,z,r,c)=>{
    ring(r,.06,c,x,y,z);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([x,y,z],[x+Math.cos(a)*r,y+Math.sin(a)*r,z],.018,c);}
  };

  if(type==="tent"){
    const shape=new THREE.Shape();shape.moveTo(-1,0);shape.lineTo(0,1.5);shape.lineTo(1,0);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false});
    add(geo,colors.fabric,0,0,-1);
    const door=new THREE.Shape();door.moveTo(-.45,0);door.lineTo(0,.95);door.lineTo(.45,0);door.closePath();
    add(new THREE.ShapeGeometry(door),0x364446,0,.015,1.01);
    rod([0,1.5,-1.1],[0,1.5,1.1],.025,cream);
    for(const x of [-1,1])for(const z of [-1,1]){
      rod([x,.1,z],[x*1.35,0,z*1.2],.012,cream);rod([x*1.35,0,z*1.2],[x*1.35,.16,z*1.2],.02,dark);
    }
  }else if(type==="cabin"){
    for(let y=.1;y<1.8;y+=.2){
      for(const z of [-1,1])rod([-1.3,y,z],[1.3,y,z],.11,brown);
      for(const x of [-1.2,1.2])rod([x,y,-1],[x,y,1],.11,brown);
    }
    roof(2.9,2.5,1.8,dark);box(.5,1.15,.1,0x483e31,0,.575,1.14);
    for(const x of [-.8,.8]){box(.45,.45,.1,0xe9c777,x,1.1,1.14);box(.04,.45,.12,cream,x,1.1,1.17);box(.45,.04,.12,cream,x,1.1,1.17);}
    chimney(.8,-.5,2.9);box(1.1,.15,.55,stone,0,.075,1.3);
  }else if(type==="windmill"){
    cyl(.55,.85,3,cream,0,1.5,0,16);cyl(0,.8,.9,dark,0,3.45,0,16);
    box(.4,.85,.08,brown,0,.42,.8);
    for(const y of [1.4,2.2])box(.25,.33,.08,glass,0,y,.62);
    const sails=new THREE.Group();sails.position.set(0,2.8,.8);
    for(let i=0;i<4;i++){
      const pivot=new THREE.Group();pivot.rotation.z=i*Math.PI/2;
      const spar=mesh(new THREE.BoxGeometry(.07,1.9,.09),material(brown),0,.95,0);pivot.add(spar);
      const fabric=mesh(new THREE.BoxGeometry(.38,1.1,.025),material(colors.fabric),.2,1.3,0);pivot.add(fabric);
      sails.add(pivot);
    }
    sails.userData.spin=true;g.add(sails);ball(.16,brown,0,2.8,.88);
  }else if(["cherry","willow","bamboo","cactus","bush","flowers","mushroom","lotus","reeds"].includes(type)){
    if(type==="cherry"||type==="willow"){
      cyl(.09,.2,2,brown);
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7,x=Math.cos(a)*.8,z=Math.sin(a)*.8;
        rod([0,1,0],[x,2.1,z],.075,brown);
        foliage(x,2.4,z,.65,type==="cherry"?[0xe6a4ae,0xf1bdc5,0xd48599][i%3]:0x779f55);
        if(type==="willow")for(let j=0;j<4;j++){
          const xx=x+(random()-.5)*.6,zz=z+(random()-.5)*.6;
          rod([xx,2.5,zz],[xx*1.2,.6+random(),zz*1.2],.035,0x80a75b);
        }
      }
      if(type==="cherry")for(let i=0;i<18;i++)ball(.045,0xeab0bf,(random()-.5)*2,.04,(random()-.5)*2);
    }else if(type==="bamboo"){
      for(let i=0;i<7;i++){
        const x=(random()-.5)*1.3,z=(random()-.5)*1.3,h=2+random()*1.4;
        cyl(.055,.075,h,0x72914c,x,h/2,z);
        for(let y=.4;y<h;y+=.45){cyl(.082,.082,.055,0x486838,x,y,z);const f=ball(.3,leaf,x+.2,y,z);f.scale.set(1,.15,.4);}
      }
    }else if(type==="cactus"){
      cyl(.18,.23,2,0x658c69);ball(.18,0x658c69,0,2,0);
      for(const x of [-.55,.55]){rod([0,.9,0],[x,.9,0],.14,0x658c69);cyl(.13,.14,.75,0x658c69,x,1.27);ball(.13,0x658c69,x,1.65,0);}
      for(let y=.2;y<1.8;y+=.2)box(.018,.06,.01,cream,.16,y,.15);
    }else if(type==="bush"){for(let i=0;i<5;i++)foliage((random()-.5),.4,(random()-.5),.45);}
    else if(type==="flowers"){
      for(let i=0;i<12;i++){
        const x=(random()-.5)*1.5,z=(random()-.5)*1.5,h=.25+random()*.4;
        rod([x,0,z],[x,h,z],.018,leaf);ball(.05,0xf2d073,x,h,z);
        for(let k=0;k<5;k++)ball(.065,[0xe3999c,0xe8c264,0xa698cc][i%3],x+Math.cos(k*1.256)*.09,h,z+Math.sin(k*1.256)*.09);
      }
    }else if(type==="mushroom"){
      cyl(.13,.2,.65,cream);
      const cap=add(new THREE.SphereGeometry(.6,16,10,0,Math.PI*2,0,Math.PI/2),red,0,.6,0);cap.scale.y=.65;
      for(let i=0;i<8;i++){const a=i*.78;ball(.065,cream,Math.cos(a)*.36,.87,Math.sin(a)*.36);}
    }else if(type==="lotus"){
      const pad=cyl(.65,.65,.035,0x4e936c);pad.scale.z=.75;
      for(let i=0;i<9;i++){const a=i*.7,p=ball(.16,0xe7a8b9,Math.cos(a)*.16,.13,Math.sin(a)*.16);p.scale.set(.7,1.3,.5);}
      ball(.09,0xf0d285,0,.24,0);
    }else{
      for(let i=0;i<14;i++){const x=(random()-.5),z=(random()-.5),h=.7+random()*.6;rod([x,0,z],[x+.1,h,z],.016,leaf);cyl(.045,.045,.2,brown,x+.1,h,z);}
    }
  }else if(["mountain","volcano","waterfall","dune","iceberg","cave","arch"].includes(type)){
    if(type==="dune"){
      const o=ball(2.5,0xd0ad73,0,-.2,0);o.scale.set(1.6,.6,1);
    }else if(type==="arch"||type==="cave"){
      const opening=type==="arch"?1.7:1.25;
      for(let i=0;i<=10;i++){
        const a=i*Math.PI/10;const o=ball(.65,stone,Math.cos(a)*opening,.3+Math.sin(a)*2,0);
        o.scale.set(1,1.1,type==="cave"?1.7:.75);
      }
      if(type==="cave")box(2.3,2.4,.1,0x273536,0,1.2,-.7);
    }else if(type==="waterfall"){
      for(let i=0;i<8;i++){const o=ball(1,stone,(random()-.5)*3,1.5+random()*1.2,-.4);o.scale.y=2;}
      box(1.3,3.8,.15,0x8fd4df,0,2.1,.6);
      for(let i=0;i<8;i++)box(.035,2.5+random(),.03,0xd2f2ec,(random()-.5)*1.2,2,.7);
      cyl(2,2,.08,0x4d9cad,0,.05,.9,40);
      for(let i=0;i<15;i++)ball(.15,0xd4ece5,(random()-.5)*1.6,.2,1+(random()-.5)*.8);
    }else if(type==="iceberg"){
      for(let i=0;i<5;i++){const o=cyl(.1,1,1.8+random()*2,0xaddde2,(random()-.5)*2,1, (random()-.5)*2,5);o.rotation.z=(random()-.5)*.4;}
    }else{
      const volcano=type==="volcano";
      const geo=new THREE.CylinderGeometry(volcano?.65:0,2.7,4.5,11,4,true);
      const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y<2){pos.setX(i,pos.getX(i)*(1+Math.sin(pos.getZ(i)*8+y)*.09));}}
      geo.computeVertexNormals();add(geo,volcano?0x63534c:0x818d82,0,2.25,0);
      if(!volcano){
        cyl(0,.9,1.5,0xf0f3e9,0,3.8,0,11);
        for(let i=0;i<4;i++)cyl(0,1.5,2.8,0x909889,Math.cos(i*1.6)*1.2,1.3,Math.sin(i*1.6)*1.2,7);
      }else{
        const rim=ring(.66,.14,0x4c4240,0,4.5,0);rim.rotation.x=Math.PI/2;
        add(new THREE.CircleGeometry(.59,24),0xff7526,0,4.39,0,{emissive:0xff3900,emissiveIntensity:1.4}).rotation.x=-Math.PI/2;
        for(let i=0;i<3;i++){
          const a=i*2.1;
          rod([Math.cos(a)*.7,4.35,Math.sin(a)*.7],[Math.cos(a)*2.55,.2,Math.sin(a)*2.55],.07,0xe7803b);
          const smoke=ball(.28+i*.14,0xafa89b,.1+i*.14,5+i*.45,0);smoke.userData.float=true;
        }
      }
    }
  }else if(type==="river"){
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-4,0,-1),new THREE.Vector3(-2,0,.5),new THREE.Vector3(0,0,0),new THREE.Vector3(2,0,-.5),new THREE.Vector3(4,0,1)]);
    const o=add(new THREE.TubeGeometry(curve,40,.7,8,false),0x5fa9b6,0,-.15,0);o.scale.y=.2;
    for(let i=0;i<20;i++){const p=curve.getPoint(i/19);ball(.12,0x9faaa0,p.x,.02,p.z+(i%2?-.72:.72));}
  }else if(["torii","moon_gate","corridor","stone_lion"].includes(type)){
    if(type==="torii"){
      for(const x of [-1,1])cyl(.1,.14,2.8,red,x);
      box(3,.22,.28,dark,0,2.85);box(2.6,.16,.22,red,0,2.3);
      box(.18,.65,.15,red,0,2.55);
    }else if(type==="moon_gate"){
      const tor=ring(1,.3,cream,0,1.15,0);tor.scale.z=.6;
      for(const x of [-1.45,1.45])box(.8,2.6,.3,cream,x);
      box(3.8,.16,.48,dark,0,2.65);
      box(2.4,.15,.6,stone,0,.05);
    }else if(type==="corridor"){
      for(const x of [-2,-.7,.7,2])for(const z of [-.55,.55])cyl(.06,.06,1.8,red,x,.9,z);
      box(4.5,.15,1.5,cream);const r=roof(1.8,4.6,1.8,0x466a67);r.rotation.y=Math.PI/2;
    }else{
      box(1,.25,1,0xa5a89b);ball(.4,stone,0,.7,0);ball(.3,stone,0,1.17,.2);
      for(const x of [-.23,.23])ball(.12,stone,x,.38,.35);
      for(let i=0;i<9;i++)ball(.11,stone,Math.cos(i*.7)*.28,1.1+Math.sin(i*.7)*.27,.04);
      ball(.14,0x93998b,0,1.1,.46);
    }
  }else if(["castle","church","mosque","barn","greenhouse","shop","cafe","warehouse","factory","observatory","apartment","clocktower"].includes(type)){
    if(type==="castle"){
      box(3,2.3,2,0xb7b7a3);
      for(const x of [-1.5,1.5])for(const z of [-1,1]){
        cyl(.55,.62,3.3,0xb7b7a3,x,1.65,z,12);cyl(0,.75,1.2,red,x,3.9,z,12);
      }
      for(let x=-1.25;x<=1.25;x+=.5)box(.25,.4,.3,cream,x,2.55,1);
      box(.85,1.4,.08,brown,0,.7,1.04);
    }else if(type==="church"){
      house(2.6,2.2,3);box(1,3.8,1,cream,0,1.9,1);
      roof(1.3,1.3,3.8);rod([0,4.1,1],[0,5,1],.055,dark);rod([-.28,4.7,1],[.28,4.7,1],.055,dark);
      const rose=ring(.25,.04,0xd5b87c,0,2.65,1.52);
      box(.55,1.3,.06,brown,0,.65,1.55);
    }else if(type==="mosque"){
      box(3,1.7,2.5,cream);
      add(new THREE.SphereGeometry(1.3,24,12,0,Math.PI*2,0,Math.PI/2),0x65988c,0,1.7,0);
      cyl(.16,.28,3.6,cream,1.8,1.8,0);cyl(0,.35,.7,0x65988c,1.8,3.95);
      cyl(.03,.03,.5,0xcbb46a,0,3.25);
    }else if(type==="greenhouse"){
      const o=box(3,1.7,2.2,glass);o.material.transparent=true;o.material.opacity=.32;
      const glassRoof=roof(3.1,2.3,1.7,glass);glassRoof.material.opacity=.45;glassRoof.material.transparent=true;
      for(const x of [-1.5,0,1.5])for(const z of [-1.1,1.1])rod([x,0,z],[x,1.8,z],.035,cream);
      for(let x=-1;x<=1;x+=.5){cyl(.16,.12,.25,red,x,.125);foliage(x,.5,0,.25);}
    }else if(type==="factory"){
      box(3.5,1.8,2.5,0xb5977d);windows(3.5,1.8,2.5);
      for(let x=-1.2;x<=1.2;x+=.8)roof(.85,2.6,1.8,dark).position.x=x;
      chimney(1.4,-.8,4);chimney(.65,-.8,3.3);
    }else if(type==="observatory"){
      cyl(1.4,1.5,1.8,cream,0,.9);
      const dome=add(new THREE.SphereGeometry(1.45,24,12,0,Math.PI*2,0,Math.PI/2),0x809b9e,0,1.8);
      box(.2,1.1,.1,dark,0,2.35,1.2);rod([0,2,0],[.4,2.9,1.2],.16,cream);
    }else if(type==="clocktower"){
      box(1.2,4,1.2,cream);roof(1.5,1.5,4,dark);
      const face=cyl(.42,.42,.05,0xf8edcf,0,3.3,.63,32);face.rotation.x=Math.PI/2;
      rod([0,3.3,.68],[.23,3.3,.68],.025,dark);rod([0,3.3,.68],[0,3.6,.68],.025,dark);
    }else if(type==="apartment"){
      box(3,4.5,2,0xc7b495);windows(3,4.5,2);
      for(let y=.7;y<4.4;y+=.85)for(const x of [-.85,.85]){
        box(.9,.1,.45,cream,x,y,1.2);box(.9,.25,.06,dark,x,y+.18,1.43);
      }
      box(3.2,.16,2.2,dark,0,4.5);
    }else{
      const isBarn=type==="barn",isWarehouse=type==="warehouse";
      if(!isBarn)house(isWarehouse?4:3,2,2.5);
      if(isBarn){
        box(3,2,2.5,red);roof(3.3,2.8,2,dark);box(1.3,1.5,.08,brown,0,.75,1.3);
        rod([-.6,.05,1.36],[.6,1.45,1.36],.04,cream);rod([.6,.05,1.36],[-.6,1.45,1.36],.04,cream);
      }else if(isWarehouse){box(2.3,1.5,.1,0x80918c,0,.75,1.3);for(let y=.2;y<1.5;y+=.2)box(2.3,.03,.03,dark,0,y,1.37);}
      else if(type==="shop"||type==="cafe"){
        box(2,.95,.06,glass,0,1.1,1.29);
        for(let x=-1.4;x<1.5;x+=.35){const a=box(.35,.1,.9,Math.round((x+1.4)/.35)%2?cream:red,x,1.85,1.55);a.rotation.x=.2;}
        if(type==="cafe"){cyl(.4,.4,.07,brown,1.5,.85,2);cyl(.04,.06,.8,dark,1.5,.4,2);bench(-.4,2);}
      }
    }
  }else if(["car","bus","truck","tram","bicycle","motorcycle","airplane","helicopter","rocket","ufo"].includes(type)){
    if(type==="bicycle"||type==="motorcycle"){
      const motor=type==="motorcycle",r=motor?.35:.42;
      for(const x of [-.65,.65])wheelSpokes(x,r,0,r,dark);
      rod([-.65,r,0],[0,.42,0],.035,red);rod([0,.42,0],[-.2,1,0],.035,red);
      rod([-.2,1,0],[-.65,r,0],.035,red);rod([-.2,1,0],[.5,.95,0],.035,red);rod([.5,.95,0],[.65,r,0],.035,dark);rod([0,.42,0],[.5,.95,0],.035,red);
      box(.35,.08,.2,dark,-.2,1.05);rod([.5,.95,-.2],[.5,.95,.2],.04,dark);
      if(motor){ball(.3,red,0,.7,0).scale.set(1,.65,.65);box(.45,.35,.3,dark,0,.4);}
    }else if(type==="airplane"){
      const fus=cyl(.3,.22,4,cream,0,.8,0);fus.rotation.z=Math.PI/2;
      ball(.3,glass,1.75,.8,0);box(1.4,.1,5,cream,0,.75);
      box(.7,.12,1.7,red,-1.6,1);box(.6,.9,.1,red,-1.6,1.15);
      for(const z of [-1.3,1.3]){const e=cyl(.18,.18,.85,dark,.2,.5,z);e.rotation.z=Math.PI/2;}
      wheels(2,1,.16);
    }else if(type==="helicopter"){
      const body=ball(.7,0xcb9c57,0,1,0);body.scale.set(1.5,.8,.75);
      const windshield=ball(.5,glass,.65,1,.02);windshield.scale.set(.7,.8,.85);
      rod([-.4,1,0],[-2.3,1.2,0],.12,0xcb9c57);
      for(const z of [-.55,.55]){rod([-.8,.2,z],[.8,.2,z],.045,dark);rod([-.3,.2,z],[-.3,.8,z*.6],.045,dark);}
      cyl(.07,.07,.45,dark,0,1.75);
      const rotor=new THREE.Group();rotor.position.y=1.98;
      for(const a of [0,Math.PI/2]){const blade=mesh(new THREE.BoxGeometry(4.2,.04,.13),material(dark));blade.rotation.y=a;rotor.add(blade);}
      rotor.userData.rotor=true;g.add(rotor);wheelSpokes(-2.3,1.2,0,.3,dark);
    }else if(type==="rocket"){
      cyl(.55,.55,3.7,cream,0,2.1);cyl(0,.55,1.2,red,0,4.55);
      cyl(.6,.7,.35,dark,0,.3);
      for(const a of [0,Math.PI*.66,Math.PI*1.33]){const fin=box(.13,1.3,.75,red,Math.sin(a)*.55,.8,Math.cos(a)*.55);fin.rotation.y=a;}
      cyl(1.4,1.6,.15,0x7b8586,0,.08);
      for(const z of [-.55,.55])ball(.18,glass,0,3.1,z);
    }else if(type==="ufo"){
      const disc=ball(1.6,0xb3c2bf,0,.65,0);disc.scale.y=.2;
      add(new THREE.SphereGeometry(.7,20,10,0,Math.PI*2,0,Math.PI/2),glass,0,.65,0);
      for(let i=0;i<10;i++){const a=i*.628;ball(.07,colors.accent,Math.cos(a)*1.4,.62,Math.sin(a)*1.4);}
      for(let i=0;i<3;i++){const a=i*2.094;rod([Math.cos(a)*.65,.6,Math.sin(a)*.65],[Math.cos(a)*.9,0,Math.sin(a)*.9],.045,dark);}
    }else{
      const long=type!=="car",length=long?4:2.7,width=1.2;
      box(length,.6,width,type==="bus"?0xcaaa5f:type==="tram"?0x5d978d:red,0,.65);
      box(type==="truck"?1.1:length*.75,.7,width*.93,cream,type==="truck"?1.2:0,1.28);
      if(type==="truck")box(2.5,1.2,1.25,0x86a0a2,-.55,1.3);
      for(let x=-length*.25;x<=length*.3;x+=.6)for(const z of [-.57,.57])box(.42,.42,.035,glass,x,1.3,z);
      wheels(length,width,.28);
      for(const z of [-.4,.4])box(.05,.15,.2,0xf9dfa7,length/2+.02,.7,z);
      if(type==="tram"){rod([-.5,1.7,0],[0,2.3,0],.035,dark);rod([0,2.3,0],[.5,1.7,0],.035,dark);box(4.8,.06,.05,dark,0,.08,.4);box(4.8,.06,.05,dark,0,.08,-.4);}
    }
  }else if(["fishing_boat","ship","submarine","buoy","dock"].includes(type)){
    if(type==="dock"){
      for(let x=-2;x<=2;x+=.24)box(.22,.12,1.2,brown,x,.4);
      for(const x of [-1.8,0,1.8])for(const z of [-.55,.55])cyl(.06,.07,.9,brown,x,.25,z);
    }else if(type==="buoy"){
      cyl(.3,.45,.6,red,0,.3);cyl(0,.3,.5,cream,0,.85);cyl(.025,.025,.5,dark,0,1.25);ball(.08,colors.accent,0,1.55,0);
    }else if(type==="submarine"){
      const hull=ball(1,0xc5a655,0,.45,0);hull.scale.set(2.5,.55,.65);
      box(.8,.7,.55,0xc5a655,0,1);rod([0,1.3,0],[0,1.8,0],.055,dark);rod([0,1.8,0],[.25,1.8,0],.055,dark);
      for(const x of [-1,-.4,.4,1])ball(.1,glass,x,.6,.55);
    }else{
      const ship=type==="ship",length=ship?5:3;
      const hull=cyl(.75,.45,.65,dark,0,.25,0,8);hull.scale.set(length/1.5,1,1);
      box(length*.75,.45,1.15,cream,0,.7);
      box(length*.45,.55,.9,ship?cream:red,0,1.18);windows(length*.45,1.6,.9);
      if(ship){box(2,.35,.75,cream,0,1.65);chimney(-.4,0,2.2);}
      else{rod([-1,.4,0],[-1,2.1,0],.035,brown);rod([-1,2,0],[.7,1.3,.7],.025,brown);}
    }
  }else if(["dog","cat","horse","cow","sheep","deer","bird","fish"].includes(type)){
    if(type==="bird"||type==="fish"){
      const fish=type==="fish",body=ball(.35,fish?0xd9a75d:0x699ba6,0,.4,0);body.scale.set(1.4,.8,.6);
      cyl(0,.13,.35,fish?0xd08a4e:0xe0b75f,.48,.4,0,4).rotation.z=-Math.PI/2;
      const tail=box(.3,.4,.06,red,-.48,.4);tail.rotation.z=.4;
      for(const z of [-.2,.2])ball(.035,dark,.2,.5,z);
      if(!fish)for(const z of [-.3,.3]){const wing=ball(.28,0x588a99,-.1,.42,z);wing.scale.set(1,.15,1.3);}
    }else{
      const fur=type==="cow"?cream:type==="sheep"?0xe5e1d4:type==="cat"?0x9c9990:type==="dog"?0xb89b72:0xa07850;
      const body=ball(.5,fur,0,.7,0);body.scale.set(1.6,.8,.75);
      ball(.3,fur,.7,1,0);ball(.18,fur,.95,.9,0);
      for(const x of [-.45,.45])for(const z of [-.22,.22])rod([x,.6,z],[x,.08,z],.07,fur);
      for(const z of [-.19,.19]){cyl(0,.1,.25,fur,.62,1.29,z,4);ball(.033,dark,.87,1.07,z);}
      rod([-.65,.7,0],[-.95,1,0],.045,fur);
      if(type==="sheep")for(let i=0;i<18;i++)ball(.18,cream,(random()-.5)*1.2,.65+random()*.4,(random()-.5)*.7);
      if(type==="cow")for(let i=0;i<6;i++){const s=ball(.2,dark,(random()-.5)*.9,.8, i%2?.34:-.34);s.scale.z=.2;}
      if(type==="horse"){for(let y=.8;y<1.2;y+=.09)ball(.085,brown,.5,y,-.08);rod([-.7,.75,0],[-.9,.15,0],.07,brown);}
      if(type==="deer")for(const z of [-.15,.15]){
        rod([.65,1.2,z],[.5,1.8,z*2],.035,brown);rod([.55,1.55,z*1.7],[.75,1.75,z*2.5],.028,brown);
      }
    }
  }else if(["bench","chair","fountain","statue","well","fence","streetlight","traffic_light","mailbox","phonebooth","umbrella","picnic_table","market_stall","ferris_wheel","swing","slide","signpost","crate","barrel","flag","solar_panel","wind_turbine","telescope"].includes(type)){
    if(type==="bench")bench();
    else if(type==="chair"){box(.55,.08,.55,brown,0,.5);box(.55,.5,.07,brown,0,.77,-.25);for(const x of [-.22,.22])for(const z of [-.22,.22])box(.06,.5,.06,dark,x,.25,z);}
    else if(type==="fountain"){
      cyl(1.2,1.3,.25,cream);cyl(1.05,1.05,.03,glass,0,.27);
      cyl(.12,.25,1.2,cream,0,.8);cyl(.55,.2,.2,cream,0,1.4);
      for(let i=0;i<8;i++){const a=i*.785;rod([0,1.6,0],[Math.cos(a)*.8,.4,Math.sin(a)*.8],.022,glass);}
    }else if(type==="statue"){
      box(.8,.5,.8,stone);cyl(.16,.28,.85,0xa9b6ab,0,.95);ball(.2,0xa9b6ab,0,1.65,0);
      rod([0,1.2,0],[.6,1.7,0],.065,0xa9b6ab);rod([0,1.2,0],[-.3,.8,0],.065,0xa9b6ab);
    }else if(type==="well"){
      for(let layer=0;layer<3;layer++)for(let i=0;i<12;i++){const a=(i+layer*.5)*.524;const b=box(.3,.2,.2,stone,Math.cos(a)*.6,.1+layer*.2,Math.sin(a)*.6);b.rotation.y=-a;}
      for(const x of [-.8,.8])box(.1,1.6,.1,brown,x,.8);roof(2,1.5,1.6);rod([-.8,1.2,0],[.8,1.2,0],.06,brown);rod([0,1.2,0],[0,.4,0],.015,cream);
    }else if(type==="fence"){
      for(let x=-1.2;x<1.3;x+=.3){box(.12,.9,.1,cream,x,.45);cyl(0,.09,.15,cream,x,.98,0,4);}
      for(const y of [.25,.65])box(2.6,.1,.12,brown,0,y,-.06);
    }else if(type==="streetlight"||type==="traffic_light"){
      cyl(.035,.07,2.8,dark);
      if(type==="streetlight"){rod([0,2.8,0],[.5,2.8,0],.035,dark);box(.5,.1,.25,cream,.5,2.75);}
      else{box(.35,.9,.22,dark,0,2.45,.15);for(let i=0;i<3;i++)ball(.09,[0xdc695d,0xddc45c,0x73a58b][i],0,2.73-i*.27,.3);}
    }else if(type==="mailbox"){cyl(.035,.05,.6,dark);box(.55,.5,.45,0x649487,0,.83);box(.36,.04,.02,dark,0,.88,.235);}
    else if(type==="phonebooth"){
      box(.9,.12,.9,red);box(.95,.18,.95,red,0,2.05);
      for(const x of [-.4,.4])for(const z of [-.4,.4])box(.06,2,.06,red,x,1,z);
      for(const z of [-.4,.4]){box(.75,1.45,.025,glass,0,1.1,z);for(let y=.5;y<1.9;y+=.3)box(.8,.035,.04,red,0,y,z);}
    }else if(type==="umbrella"){
      cyl(.035,.05,2,brown);
      for(let i=0;i<8;i++)add(new THREE.ConeGeometry(1.2,.45,4,1,true,i*Math.PI/4,Math.PI/4),i%2?cream:red,0,2,0);
    }else if(type==="picnic_table"){
      box(2,.12,1,brown,0,.8);for(const z of [-.8,.8])box(2,.1,.3,brown,0,.45,z);
      for(const x of [-.7,.7]){rod([x,.8,-.3],[x,0,-.75],.06,dark);rod([x,.8,.3],[x,0,.75],.06,dark);}
    }else if(type==="market_stall"){
      for(const x of [-1,1])for(const z of [-.5,.5])rod([x,0,z],[x,2.1,z],.045,brown);
      box(2.1,.85,1,brown);
      for(let x=-1.1;x<1.2;x+=.3){const a=box(.3,.08,1.6,Math.round((x+1.1)/.3)%2?cream:0x7e9e78,x,2.1);a.rotation.x=.13;}
      for(let i=0;i<15;i++)ball(.09,[red,0xdac363,0x8baf74][i%3],(random()-.5)*1.8,.96,(random()-.5)*.8);
    }else if(type==="ferris_wheel"){
      wheelSpokes(0,3,0,2.4,cream);ring(2.35,.06,red,0,3,-.25);
      for(const z of [-.45,.45]){rod([-1.3,0,z],[0,3,z],.09,dark);rod([1.3,0,z],[0,3,z],.09,dark);}
      for(let i=0;i<10;i++){const a=i*Math.PI/5,x=Math.cos(a)*2.4,y=3+Math.sin(a)*2.4;box(.5,.45,.55,i%2?red:0x7ea7a4,x,y-.25);rod([x,y,-.3],[x,y+.25,-.3],.03,dark);}
    }else if(type==="swing"){
      for(const x of [-1,1])for(const z of [-.6,.6])rod([x,0,z],[x,2.2,0],.06,brown);
      rod([-1.2,2.2,0],[1.2,2.2,0],.07,brown);
      for(const x of [-.3,.3])rod([x,2.15,0],[x,.45,0],.015,dark);
      box(.75,.08,.4,red,0,.45);
    }else if(type==="slide"){
      box(.8,.12,.7,cream,-.6,1.7);
      for(const z of [-.3,.3]){rod([-.9,0,z],[-.9,1.7,z],.04,dark);rod([-.4,1.7,z],[1.3,.15,z],.05,red);}
      for(let y=.3;y<1.7;y+=.3)rod([-.9,y,-.3],[-.9,y,.3],.04,cream);
      const s=box(2.3,.07,.6,0xd6b257,.45,.9);s.rotation.z=-.73;
    }else if(type==="signpost"){cyl(.035,.06,1.7,brown);box(.85,.24,.08,0x669389,.3,1.3);box(.85,.24,.08,cream,-.25,1.6);}
    else if(type==="crate"){
      box(.8,.8,.8,0xb29362);
      for(const x of [-.34,.34])box(.08,.8,.84,brown,x,.4);
      for(const z of [-.34,.34])box(.84,.08,.08,brown,0,.7,z);
      const b=box(1,.08,.04,brown,0,.4,.42);b.rotation.z=.75;
    }else if(type==="barrel"){
      const points=[[.32,0],[.4,.2],[.43,.5],[.4,.8],[.32,1]].map(p=>new THREE.Vector2(...p));
      add(new THREE.LatheGeometry(points,16),0xa98251);
      for(const y of [.2,.8]){const r=ring(.4,.025,dark,0,y);r.rotation.x=Math.PI/2;}
      cyl(.32,.32,.05,brown,0,.99);
    }else if(type==="flag"){
      cyl(.025,.04,2.4,dark);box(1,.6,.04,red,.5,2);ball(.07,cream,0,2.45);
    }else if(type==="solar_panel"){
      for(const x of [-.6,.6])rod([x,0,0],[x,1,0],.035,dark);
      const p=box(1.9,.06,1.2,0x315f80,0,1);p.rotation.x=.35;
      for(const x of [-.6,0,.6]){const r=box(.02,.07,1.2,cream,x,1);r.rotation.x=.35;}
    }else if(type==="wind_turbine"){
      cyl(.08,.25,4.5,cream);ball(.18,cream,0,4.3,.2);
      const blades=new THREE.Group();blades.position.set(0,4.3,.32);
      for(let i=0;i<3;i++){const pivot=new THREE.Group();pivot.rotation.z=i*Math.PI*2/3;const b=mesh(new THREE.BoxGeometry(.16,2,.06),material(cream),0,1,0);pivot.add(b);blades.add(pivot);}
      blades.userData.spin=true;g.add(blades);
    }else{
      for(let i=0;i<3;i++){const a=i*2.094;rod([Math.cos(a)*.5,0,Math.sin(a)*.5],[0,1,0],.035,dark);}
      const scope=cyl(.16,.12,1,cream,0,1.2);scope.rotation.z=.8;
      const lens=cyl(.15,.15,.03,glass,-.36,1.55);lens.rotation.z=.8;
    }
  }else return null;
  return g;
}
