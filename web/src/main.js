import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createAsset, material, mesh, assetDefinition, catalog } from "./models.js";
import { planLayout, appendLayout } from "./layout.js";
import { createLandscape, objectElevation, refreshPaths } from "./landscape.js";
import { skyColor, createSky, createMoon, positionMoon, faceMoon } from "./sky.js";
import { createSceneEditor } from "./editing.js";
import "./style.css";

const host = document.querySelector("#canvas-host");
const form = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt");
const composeButton = document.querySelector("#compose-button");
const loading = document.querySelector("#loading");
const status = document.querySelector("#status");
const summary = document.querySelector("#scene-summary");
const environmentLabel = document.querySelector("#scene-environment");
const lightingLabel = document.querySelector("#scene-lighting");
const cameraLabel = document.querySelector("#scene-camera");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const effects = new EffectComposer(renderer);
effects.addPass(new RenderPass(scene,camera));
const contactShadows = new SSAOPass(scene,camera,1,1,12);
contactShadows.kernelRadius = .65;
contactShadows.minDistance = .0002;
contactShadows.maxDistance = .018;
effects.addPass(contactShadows);
effects.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 6;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1.2, 0);

let world = new THREE.Group();
let animated = [];
let assetBounds = new THREE.Box3();
let previewMode = false;
let skyMoon = null;
let landscape = null;
let currentSpec = null;
let currentLayout = null;
let waterTimes = [];
let composeMode = "replace";
scene.add(world);

const editor = createSceneEditor({
  canvas: renderer.domElement, camera, controls, scene,
  panel: document.querySelector("#selection-panel"),
  label: document.querySelector("#selected-name"),
  reset: document.querySelector("#reset-position"),
  dismiss: document.querySelector("#deselect-object"),
  scaleInput: document.querySelector("#object-scale"),
  rotationInput: document.querySelector("#object-rotation"),
  onSelect(item) { host.dataset.selectedAsset = item?.model.name || ""; },
  onChange: updateSceneAfterEdit,
});

function updateSceneAfterEdit() {
    if (!currentLayout || !landscape) return;
    refreshPaths(landscape, currentLayout, currentSpec);
    host.dataset.pathCount = landscape.paths.length;
    updateLayoutData();
    assetBounds.makeEmpty();
    for (const item of currentLayout.items) assetBounds.union(new THREE.Box3().setFromObject(item.model));
    if (skyMoon) {
      const diameter = skyMoon.scale.x * 2.8;
      assetBounds.union(new THREE.Box3().setFromCenterAndSize(skyMoon.position, new THREE.Vector3(diameter, diameter, diameter)));
    }
}

function updateLayoutData() {
  host.dataset.layout = JSON.stringify(currentLayout.items.map(({type,x,z,width,depth,height,model,editScale})=>
    ({id:model.name,type,x,z,width,depth,height,rotation:model.rotation.y,scale:editScale??1})));
}

const paletteMap = {
  natural: { fabric: 0xd7b982, wood: 0x6d4930, leaf: 0x315f42, accent: 0xffa84c, stone: 0x737772 },
  autumn: { fabric: 0xd28a55, wood: 0x58352c, leaf: 0x9b5a31, accent: 0xffc05a, stone: 0x765c55 },
  winter: { fabric: 0xdce8ed, wood: 0x5c5551, leaf: 0x365e62, accent: 0xffd584, stone: 0x87939a },
  desert: { fabric: 0xd9a66f, wood: 0x774a35, leaf: 0x71804b, accent: 0xff8d55, stone: 0x9a725b },
  mystic: { fabric: 0x4c3e68, wood: 0x242b35, leaf: 0x244a50, accent: 0x52f5e7, stone: 0x453c57 },
  mono: { fabric: 0xd9dcdd, wood: 0x44494c, leaf: 0x4e5a57, accent: 0xbafc84, stone: 0x697074 },
};

const environmentMap = {
  meadow: { ground: 0x354f35, background: 0x8fb0a4, fog: 0x8fb0a4 },
  forest: { ground: 0x263b32, background: 0x344841, fog: 0x344841 },
  snow: { ground: 0xdce7e8, background: 0x9db0bb, fog: 0x9db0bb },
  desert: { ground: 0xb98455, background: 0xd2a778, fog: 0xd2a778 },
  volcanic: { ground: 0x302b2e, background: 0x3a252a, fog: 0x3a252a },
  moon: { ground: 0x686d78, background: 0x090d1c, fog: 0x090d1c },
  ocean: { ground: 0xd9bf86, background: 0x92c7da, fog: 0x92c7da },
  coast: { ground: 0xe7cc91, background: 0xa0d2de, fog: 0xa0d2de },
  city: { ground: 0x66767c, background: 0xa1b7c4, fog: 0xa1b7c4 },
  garden: { ground: 0x647d55, background: 0xb4c6a6, fog: 0xb4c6a6 },
};


function seededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}


function disposeWorld() {
  editor.clear();
  currentLayout = null;
  scene.remove(world);
  world.traverse((child) => {
    if (child.isLight && child.dispose) child.dispose();
    if (child.isInstancedMesh) child.dispose();
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((entry) => entry.dispose());
    }
  });
  world = new THREE.Group();
  animated = [];
  skyMoon = null;
  landscape = null;
  waterTimes = [];
  scene.add(world);
}

function addLighting(kind) {
  const settings = {
    day: { hemiSky: 0xd9efff, hemiGround: 0x455940, intensity: 2.1, sun: 0xfff4d6, sunIntensity: 3.2, pos: [5, 9, 4], exposure: 1.05 },
    sunset: { hemiSky: 0xd4e5ef, hemiGround: 0x72715c, intensity: 1.9, sun: 0xffd29a, sunIntensity: 2.8, pos: [-7, 5, 2], exposure: 1.05 },
    night: { hemiSky: 0x617ac2, hemiGround: 0x141827, intensity: 1.3, sun: 0x9cbcff, sunIntensity: 2.2, pos: [-4, 8, -4], exposure: 0.84 },
    overcast: { hemiSky: 0xd8e0e2, hemiGround: 0x53605b, intensity: 2.2, sun: 0xe8eeee, sunIntensity: 2.3, pos: [2, 8, 4], exposure: 0.96 },
    neon: { hemiSky: 0x2c4665, hemiGround: 0x170e24, intensity: 0.75, sun: 0x45f5e7, sunIntensity: 2.5, pos: [5, 6, 1], exposure: 0.9 },
  }[kind];
  renderer.toneMappingExposure = settings.exposure;
  world.add(new THREE.HemisphereLight(settings.hemiSky, settings.hemiGround, settings.intensity));
  const sun = new THREE.DirectionalLight(settings.sun, settings.sunIntensity);
  sun.position.set(...settings.pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  world.add(sun);
  if (kind === "neon") {
    const magenta = new THREE.PointLight(0xff4ab7, 18, 16);
    magenta.position.set(-5, 3, -3);
    world.add(magenta);
  }
}

function addStars(random) {
  const positions = [];
  for (let index = 0; index < 260; index += 1) {
    positions.push((random() - 0.5) * 50, 7 + random() * 17, (random() - 0.5) * 50);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  world.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xddeaff, size: 0.055 })));
}


function addAtmosphere(kind, colors, random) {
  if (kind === "stars") {
    addStars(random);
    return;
  }
  if (kind !== "fireflies" && kind !== "embers") return;
  const positions = [];
  const count = kind === "fireflies" ? 70 : 110;
  for (let index = 0; index < count; index += 1) {
    positions.push((random() - 0.5) * 18, 0.35 + random() * 4.5, (random() - 0.5) * 18);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const color = kind === "fireflies" ? colors.accent : 0xff7a32;
  const particles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size: kind === "fireflies" ? 0.075 : 0.045 }),
  );
  particles.userData.spin = true;
  world.add(particles);
}

function applyCamera(kind, random) {
  const positions = {
    isometric: [6, 15, 19],
    cinematic: [4, 4.8, 20],
    top_down: [0.1, 18, 0.1],
    eye_level: [12, 2.8, 10],
  };
  const [baseX, baseY, baseZ] = positions[kind];
  if (kind === "top_down") {
    camera.position.set((random() - 0.5) * 1.5, baseY + (random() - 0.5) * 2, (random() - 0.5) * 1.5);
  } else {
    const angle = (random() - 0.5) * 0.72;
    const radiusScale = 0.88 + random() * 0.24;
    camera.position.set(
      (baseX * Math.cos(angle) - baseZ * Math.sin(angle)) * radiusScale,
      baseY * (0.9 + random() * 0.2),
      (baseX * Math.sin(angle) + baseZ * Math.cos(angle)) * radiusScale,
    );
  }
  camera.fov = kind === "cinematic" ? 38 : 42;
  camera.updateProjectionMatrix();
  controls.target.set(0, kind === "top_down" ? 0 : 1.2, 0);
  fitAssets();
  controls.update();
}

function fitAssets() {
  if (assetBounds.isEmpty()) return;
  const target = assetBounds.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(target);
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  let distance = previewMode ? 4 : 13;
  for (const x of [assetBounds.min.x, assetBounds.max.x])
    for (const y of [assetBounds.min.y, assetBounds.max.y])
      for (const z of [assetBounds.min.z, assetBounds.max.z]) {
        const delta = new THREE.Vector3(x, y, z).sub(target);
        distance = Math.max(distance, delta.dot(direction) + Math.max(
          Math.abs(delta.dot(right)) / tanH, Math.abs(delta.dot(up)) / tanV,
        ) * 1.12);
      }
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.far = Math.max(600, distance + 350);
  controls.maxDistance = Math.max(150, distance * 2);
  camera.updateProjectionMatrix();
  if (scene.fog) { scene.fog.near = distance + 15; scene.fog.far = distance + 180; }
}

function prepareItems(spec, colors, random) {
  const prepared = [];
  for (const objectSpec of spec.objects) {
    const definition = assetDefinition(objectSpec.type);
    if (!definition) throw new Error("Unsupported asset: " + objectSpec.type);
    for (let index = 0; index < objectSpec.count; index++) {
      const model = createAsset(objectSpec.type, colors, random);
      if (objectSpec.type === "pond" && spec.waterScale === "large") model.scale.set(1.8,1,1.8);
      // Buildings share street alignment; people face the viewing side.
      const facing = ["architecture","vehicle","decor","people"].includes(definition.group);
      model.rotation.y = facing ? (random() - .5) * .18 : random() * Math.PI * 2;
      const variation = ["architecture","flora","terrain"].includes(definition.group) ? .88 + random() * .24 : .96 + random() * .08;
      model.scale.multiplyScalar(variation);
      model.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      if (["tent","chair"].includes(objectSpec.type) || definition.group === "people") {
        const diameter = Math.hypot(size.x,size.z); size.x = diameter; size.z = diameter;
      }
      prepared.push({ type: objectSpec.type, group: definition.group, model, index, count: objectSpec.count,
        placement: objectSpec.placement, anchor: objectSpec.anchor, width:size.x, depth:size.z, height:size.y });
    }
  }
  return prepared;
}

function renderScene(spec, promptText) {
  disposeWorld();
  previewMode = !!spec.preview;
  currentSpec = spec;
  const random = seededRandom(promptText + "|" + (spec.variant ?? 0));
  const colors = paletteMap[spec.palette] || paletteMap.natural;
  const environment = environmentMap[spec.environment] || environmentMap.meadow;
  const coastal = spec.environment === "ocean" || spec.environment === "coast";
  const sky = skyColor(spec);
  scene.background = new THREE.Color(sky);
  if(spec.environment !== "moon") world.add(createSky(spec));
  scene.fog = spec.atmosphere === "mist"
    ? new THREE.Fog(sky, 6, 20)
    : new THREE.Fog(sky, 15, 34);
  skyMoon = createMoon(spec.moon);
  if (skyMoon) world.add(skyMoon);
  host.dataset.moon = skyMoon ? spec.moon : "none";
  host.dataset.skyColor = scene.background.getHexString();

  addLighting(spec.lighting);
  if ((spec.lighting === "night" || spec.lighting === "neon" || spec.environment === "moon") && spec.atmosphere !== "stars") {
    addStars(random);
  }
  addAtmosphere(spec.atmosphere || "clear", colors, random);

  const prepared = prepareItems(spec, colors, random);
  assetBounds = new THREE.Box3();
  const renderedCounts = {};
  const layout = spec.preview ? {items:prepared.map(item=>({...item,x:0,z:0})),
    landRadius:Math.max(2.5,...prepared.map(item=>Math.max(item.width,item.depth)*.8))} : planLayout(prepared, spec, random);
  currentLayout = layout;
  landscape = createLandscape(spec, layout, environment.ground, random);
  world.add(landscape.group);
  for (const item of layout.items) {
    const { model, type, x, z, index } = item;
    model.position.set(x, objectElevation(item,spec,landscape.heightAt), z);
    if (item.facing !== undefined) model.rotation.y = item.facing;
    model.name = type + "-" + index;
    world.add(model);
    model.updateMatrixWorld(true);
    assetBounds.union(new THREE.Box3().setFromObject(model));
    renderedCounts[type] = (renderedCounts[type] || 0) + 1;
    if (["boat","fishing_boat","ship","submarine","fish","lotus"].includes(type) && !coastal &&
        !layout.items.some(p => ["pond","river"].includes(p.type) && Math.hypot(p.x-x,p.z-z)<2)) {
      const pool = mesh(new THREE.CircleGeometry(Math.max(item.width,item.depth)*.72+.4,32),material(0x5a9fae),x,.015,z);
      pool.rotation.x=-Math.PI/2;pool.castShadow=false;world.add(pool);item.pool=pool;
    }
  }
  world.traverse(child => {
    if (child.isDirectionalLight) {
      const radius = layout.landRadius + 8;
      Object.assign(child.shadow.camera, {left:-radius,right:radius,top:radius,bottom:-radius,far:radius*5});
      child.position.set(-radius*.6,radius*1.2,radius*.6);
      child.shadow.camera.updateProjectionMatrix();
    }
    if (child.material?.userData.waterTime) waterTimes.push(child.material.userData.waterTime);
  });
  host.dataset.landscape = "continuous";
  host.dataset.pathCount = landscape.paths.length;
  host.dataset.renderedCounts = JSON.stringify(renderedCounts);
  updateLayoutData();
  layout.items.forEach(item => { item.label = assetLabel(item.type) + " · " + (item.index + 1); });
  editor.setItems(layout.items, spec, landscape.heightAt, landscape.extent);
  world.traverse((child) => {
    if (child.userData.flame || child.userData.float || child.userData.spin || child.userData.rotor) {
      child.userData.baseY = child.position.y;
      animated.push(child);
    }
  });
  if (skyMoon) {
    positionMoon(skyMoon, layout.landRadius, assetBounds.isEmpty() ? 0 : assetBounds.max.y);
    // Frame the moon along with the diorama on initial composition and resize.
    // A spherical bound remains valid as the flat illustration faces the viewer.
    const diameter = skyMoon.scale.x * 2.8;
    assetBounds.union(new THREE.Box3().setFromCenterAndSize(skyMoon.position, new THREE.Vector3(diameter, diameter, diameter)));
  }
  applyCamera(spec.camera, random);
  environmentLabel.textContent = spec.environment.toUpperCase();
  lightingLabel.textContent = (spec.lighting + " LIGHT").toUpperCase();
  cameraLabel.textContent = spec.camera.replace("_", " ").toUpperCase();
  updateSummary(spec);
}

function updateSummary(spec) {
  summary.replaceChildren();
  const entries = [
    spec.composition,
    spec.palette,
    spec.terrain,
    spec.atmosphere,
    ...(spec.moon && spec.moon !== "none" ? [spec.moon + " moon"] : []),
    ...spec.objects.map((item) => item.count + "× " + assetLabel(item.type)),
  ];
  for (const entry of entries) {
    const chip = document.createElement("span");
    chip.textContent = entry.toUpperCase();
    summary.appendChild(chip);
  }
}

function appendScene(delta, promptText) {
  if (!delta.objects.length) return 0;
  const random = seededRandom(promptText + "|" + delta.variant);
  const prepared = prepareItems({...currentSpec, objects:delta.objects}, paletteMap[currentSpec.palette] || paletteMap.natural, random);
  let additions;
  try {
    additions = appendLayout(prepared, currentLayout, currentSpec, random);
  } catch (error) {
    for (const item of prepared) item.model.traverse(child => {
      child.geometry?.dispose();
      if (child.material) for (const mat of [child.material].flat()) mat.dispose();
      if (child.isLight) child.dispose?.();
    });
    throw error;
  }
  const counts = JSON.parse(host.dataset.renderedCounts);
  for (const item of additions) {
    const {model,type,x,z}=item;
    item.index=counts[type]??0;
    counts[type]=(counts[type]??0)+1;
    model.name=type+"-"+item.index;
    item.label=assetLabel(type)+" · "+(item.index+1);
    model.position.set(x,objectElevation(item,currentSpec,landscape.heightAt),z);
    if (item.facing !== undefined) model.rotation.y=item.facing;
    world.add(model);
    model.traverse(child => {
      if (child.material?.userData.waterTime) waterTimes.push(child.material.userData.waterTime);
      if (child.userData.flame || child.userData.float || child.userData.spin || child.userData.rotor) {
        child.userData.baseY=child.position.y; animated.push(child);
      }
    });
  }
  currentLayout.items.push(...additions);
  currentSpec={...currentSpec,preview:false,objects:Object.entries(counts).map(([type,count])=>({type,count,placement:"auto"}))};
  previewMode=false;
  host.dataset.renderedCounts=JSON.stringify(counts);
  editor.setItems(currentLayout.items,currentSpec,landscape.heightAt,landscape.extent);
  updateSceneAfterEdit();
  updateSummary(currentSpec);
  fitAssets();
  controls.update();
  return additions.length;
}

function setComposeMode(mode) {
  composeMode=mode;
  document.querySelectorAll("[data-mode]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.mode===mode)));
  document.querySelector("#mode-hint").textContent=mode==="append"
    ? "Keep existing objects and edits. Describe only what to add."
    : "Build a fresh world from your prompt.";
  composeButton.querySelector("span").textContent=mode==="append"?"Add to scene":"Compose scene";
  promptInput.placeholder=mode==="append"?"Add two cherry trees beside the pond and a bench in front of the tent…":"Describe a new world…";
}
document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click",()=>setComposeMode(button.dataset.mode)));

function setBusy(isBusy) {
  editor.setEnabled(!isBusy);
  loading.hidden = !isBusy;
  composeButton.disabled = isBusy;
  promptInput.disabled = isBusy;
  document.querySelectorAll("[data-prompt]").forEach(button => { button.disabled = isBusy; });
  document.querySelectorAll("[data-mode]").forEach(button => { button.disabled = isBusy; });
}

function setStatus(message, isError = false) {
  status.classList.toggle("error", isError);
  status.lastChild.textContent = message;
}

async function compose(promptText) {
  if (composeButton.disabled) return;
  const mode=composeMode;
  setBusy(true);
  setStatus(mode==="append"?"Choosing additions for the current scene…":"Composing finite choices…");
  loading.querySelector("strong").textContent=mode==="append"?"Jev is choosing additions":"Jev is composing the scene";
  try {
    const response = await fetch("/api/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, mode, ...(mode==="append"?{current:currentSpec}:{}) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Scene composition failed");
    const added=mode==="append"?appendScene(payload.scene,promptText):null;
    if(mode!=="append")renderScene(payload.scene, promptText);
    const seconds = (payload.elapsedMs / 1000).toFixed(2);
    const confidence = Math.round(payload.scene.confidence * 100);
    setStatus(
      (mode==="append"?(added?"Added "+added+" objects · ":"No additions selected; existing scene kept · "):"") + seconds + " s · " + payload.scene.modelCalls + " Jev requests · " + payload.scene.inputTokens.toLocaleString() +
        " input tokens · " + confidence + "% confidence · variant " + payload.scene.variant +
        (payload.scene.objects.length === 0 ? " · Try naming the objects to add" : ""),
    );
    composeButton.querySelector("span").textContent = mode==="append"?"Add more":"Generate another";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Scene composition failed", true);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = promptInput.value.trim();
  if (value.length < 3) {
    setStatus("Describe a scene with at least three characters", true);
    promptInput.focus();
    return;
  }
  compose(value);
});

promptInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    setComposeMode("replace");
    promptInput.value = button.dataset.prompt;
    form.requestSubmit();
  });
});

function assetLabel(type) {
  const names = {
    tree: "Broadleaf tree", pine: "Pine tree", palm: "Palm tree", cherry: "Cherry blossom",
    willow: "Willow tree", bamboo: "Bamboo clump", boat: "Sailboat", hall: "Chinese hall",
    bridge: "Stone arch bridge", building: "Rectangular high-rise", round_tower: "Cylindrical tower",
    tapered_tower: "Stepped tower", elder: "Elderly person", person: "Pedestrian",
    arch: "Natural rock arch", corridor: "Garden corridor", lantern: "Camp lantern",
    station: "Railway station", clocktower: "Clock tower", phonebooth: "Phone booth", ufo: "UFO",
  };
  return names[type] || type.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

const groupLabels = {flora:"Plants",terrain:"Terrain",architecture:"Buildings",vehicle:"Ground transport",air:"Aircraft",
  marine:"Marine",water:"Water features",decor:"Furniture & fixtures",landmark:"Landmarks",animal:"Animals",people:"People",camp:"Camping"};
const groupSelect=document.querySelector("#catalog-group");
for(const [value,label] of Object.entries(groupLabels)){
  const option=document.createElement("option");option.value=value;option.textContent=label;groupSelect.append(option);
}
document.querySelector("#catalog-title").textContent="Available assets & quantity ranges · "+catalog.length+" types · 0–20 each";
function updateCatalog(){
  const query=document.querySelector("#catalog-search").value.trim().toLowerCase();
  const filtered=catalog.filter(item=>(!groupSelect.value||item.group===groupSelect.value)&&
    (assetLabel(item.type)+" "+item.label+" "+item.type+" "+item.description).toLowerCase().includes(query));
  document.querySelector("#catalog-count").textContent=filtered.length+" / "+catalog.length;
  const grid=document.querySelector("#catalog-grid");grid.replaceChildren();
  for(const item of filtered){
    const button=document.createElement("button");button.type="button";button.textContent=assetLabel(item.type);
    const small=document.createElement("small");small.textContent=groupLabels[item.group];button.append(small);
    button.addEventListener("click",()=>{
      if(composeButton.disabled)return;
      renderScene({preview:true,variant:7,environment:item.group==="marine"?"ocean":"meadow",
        lighting:"day",camera:"isometric",composition:"central",palette:"natural",terrain:"open",atmosphere:"clear",
        objects:[{type:item.type,count:1,placement:"center"}]},item.type);
      setStatus("Local asset preview · "+assetLabel(item.type)+" · Drag the object to move it");
      host.scrollIntoView({behavior:"smooth",block:"start"});
    });
    grid.append(button);
  }
}
document.querySelector("#catalog-search").addEventListener("input",updateCatalog);
groupSelect.addEventListener("change",updateCatalog);
updateCatalog();

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  renderer.setSize(width, height, false);
  effects.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  fitAssets();
  controls.update();
}

window.addEventListener("resize", resize);
const animationStarted = performance.now();
function animate(timestamp = performance.now()) {
  const elapsed = (timestamp - animationStarted) / 1000;
  for (const object of animated) {
    if (object.userData.flame) {
      object.scale.y = 0.9 + Math.sin(elapsed * 8) * 0.11;
      object.rotation.y += 0.012;
    }
    if (object.userData.float) {
      object.position.y = object.userData.baseY + Math.sin(elapsed * 2 + object.id) * 0.08;
      object.rotation.y += 0.004;
    }
    if (object.userData.spin) object.rotation.z -= 0.008;
    if (object.userData.rotor) object.rotation.y += 0.08;
  }
  if (!editor.dragging) controls.update();
  editor.update();
  for (const time of waterTimes) time.value = elapsed;
  faceMoon(skyMoon, camera);
  effects.render();
  requestAnimationFrame(animate);
}

const initialSpec = {
  variant: 1,
  environment: "meadow",
  lighting: "sunset",
  camera: "cinematic",
  scenery: true,
  composition: "central",
  palette: "natural",
  terrain: "rolling",
  atmosphere: "clear",
  objects: [
    { type: "tent", count: 3, placement: "auto" },
    { type: "pond", count: 1, placement: "auto" },
    { type: "chair", count: 3, placement: "auto" },
    { type: "picnic_table", count: 1, placement: "auto" },
    { type: "campfire", count: 1, placement: "center" },
    { type: "pine", count: 9, placement: "auto" },
    { type: "lantern", count: 3, placement: "auto" },
    { type: "rock", count: 3, placement: "scattered" },
  ],
};

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
  if (!currentSpec) return;
  const kind = button.dataset.view === "reset" ? currentSpec.camera : button.dataset.view;
  applyCamera(kind, seededRandom("camera"));
  cameraLabel.textContent = kind.replace("_", " ").toUpperCase();
}));
resize();
renderScene(initialSpec, "initial sunset camp");
animate();
