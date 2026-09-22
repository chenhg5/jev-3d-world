const profiles={
  pastoral:{bpm:70,beats:4,scale:[0,2,4,7,9],progression:[0,5,3,4],pad:"sine",lead:"triangle",volume:.105},
  mystic:{bpm:62,beats:4,scale:[0,3,5,7,10],progression:[0,3,7,5],pad:"sine",lead:"sine",volume:.09},
  urban:{bpm:92,beats:4,scale:[0,2,3,7,9],progression:[0,3,5,7],pad:"triangle",lead:"square",volume:.075},
  ocean:{bpm:72,beats:3,scale:[0,2,4,7,9],progression:[0,5,3,4],pad:"sine",lead:"triangle",volume:.1},
  primeval:{bpm:64,beats:4,scale:[0,3,5,7,10],progression:[0,7,5,3],pad:"triangle",lead:"sine",volume:.095},
  medieval:{bpm:78,beats:3,scale:[0,2,3,5,7,8,10],progression:[0,5,7,3],pad:"triangle",lead:"triangle",volume:.095},
};

function hash(text){
  let value=2166136261;
  for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}
  return value>>>0;
}
function profileName(spec={}){
  if(spec.scenePack==="metropolis")return "urban";
  if(spec.scenePack==="ocean_liner")return "ocean";
  if(spec.scenePack==="prehistoric")return "primeval";
  if(spec.scenePack==="medieval_city")return "medieval";
  if(spec.environment==="city"||spec.lighting==="neon")return "urban";
  if(spec.environment==="ocean"||spec.environment==="coast")return "ocean";
  if(spec.environment==="forest"||spec.palette==="mystic"||spec.lighting==="night")return "mystic";
  return "pastoral";
}

export function musicPlanForSpec(spec={}){
  const profile=profileName(spec),base=profiles[profile];
  const seed=hash([profile,spec.variant??0,spec.palette,spec.lighting,spec.world?.archetype,spec.city?.archetype].join("|"));
  const root=43+(seed%8);
  const melody=Array.from({length:base.beats*4},(_,index)=>{
    const choice=(seed+Math.imul(index+1,2654435761))>>>0;
    return index%3===2?null:base.scale[choice%base.scale.length]+(choice%5===0?12:0);
  });
  return {...base,profile,seed,root,melody};
}

const frequency=midi=>440*Math.pow(2,(midi-69)/12);

export function createSceneMusic({onStateChange=()=>{}}={}){
  let context=null,master=null,filter=null,timer=null,nextLoopAt=0,generation=0;
  let enabled=true,sessionActive=false,currentSpec=null,currentPlan=null;
  const nodes=new Set();

  function notify(){
    onStateChange({enabled,active:sessionActive&&enabled,profile:currentPlan?.profile??null});
  }
  function halt(){
    generation++;clearTimeout(timer);timer=null;nextLoopAt=0;
    for(const node of nodes){try{node.stop();}catch{}}
    nodes.clear();
    if(master&&context){
      const now=context.currentTime;
      master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(Math.max(.0001,master.gain.value),now);
      master.gain.exponentialRampToValueAtTime(.0001,now+.08);
    }
  }
  function tone(midi,start,duration,wave,level){
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency(midi),start);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+Math.min(.18,duration*.2));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain).connect(filter);nodes.add(oscillator);
    oscillator.onended=()=>{nodes.delete(oscillator);oscillator.disconnect();gain.disconnect();};
    oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  function scheduleLoop(plan,token){
    if(token!==generation||!enabled||!sessionActive||!context)return;
    const beat=60/plan.bpm,bars=4,loopDuration=beat*plan.beats*bars;
    const start=Math.max(context.currentTime+.06,nextLoopAt||0);
    for(let bar=0;bar<bars;bar++){
      const barStart=start+bar*plan.beats*beat;
      const chordRoot=plan.root+plan.progression[bar%plan.progression.length];
      for(const offset of [0,3,7])tone(chordRoot+offset,barStart,plan.beats*beat*.96,plan.pad,.032);
      tone(chordRoot-12,barStart,beat*.82,"sine",.055);
      for(let step=0;step<plan.beats;step++){
        const note=plan.melody[bar*plan.beats+step];
        if(note!==null)tone(plan.root+12+note,barStart+step*beat,beat*.54,plan.lead,.026);
      }
    }
    nextLoopAt=start+loopDuration;
    timer=setTimeout(()=>scheduleLoop(plan,token),Math.max(120,loopDuration*1000-700));
  }
  async function beginAudio(spec){
    const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContext){enabled=false;notify();return;}
    if(!context)context=new AudioContext();
    if(context.state==="suspended")await context.resume();
    halt();generation++;
    currentPlan=musicPlanForSpec(spec);
    master=context.createGain();master.gain.setValueAtTime(.0001,context.currentTime);
    master.gain.exponentialRampToValueAtTime(currentPlan.volume,context.currentTime+.35);
    filter=context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=currentPlan.profile==="urban"?2400:1800;
    filter.connect(master).connect(context.destination);
    const token=generation;scheduleLoop(currentPlan,token);notify();
  }
  function start(spec){
    currentSpec=spec;sessionActive=true;
    if(enabled)void beginAudio(spec);else notify();
  }
  function end(){sessionActive=false;halt();notify();}
  function toggle(){
    enabled=!enabled;
    if(enabled&&sessionActive)void beginAudio(currentSpec);else{halt();notify();}
    return enabled;
  }
  return {start,end,toggle,get enabled(){return enabled;},get active(){return sessionActive&&enabled;},get profile(){return currentPlan?.profile??null;}};
}
