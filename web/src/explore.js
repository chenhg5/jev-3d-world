import * as THREE from "three";
import {createSceneMusic} from "./music.js";

const solidGroups = new Set(["architecture", "vehicle", "water", "decor", "landmark", "terrain", "flora", "camp"]);
const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"]);
const viewLabels = {third: "Third person", first: "First person", overview: "Overview"};
const avatarColors = {
  ember: 0xd95f3b, ochre: 0xd6a332, moss: 0x3f684d, ocean: 0x3979a8,
  ice: 0xa9d4df, violet: 0x71518c, charcoal: 0x30363d, cream: 0xe8ddc5, sand: 0xc6a26a,
};
const paletteOutfits = {
  natural: {jacket:"ember", trousers:"charcoal", accessory:"none", accessoryColor:"moss"},
  autumn: {jacket:"ochre", trousers:"charcoal", accessory:"scarf", accessoryColor:"ember"},
  winter: {jacket:"ice", trousers:"ocean", accessory:"scarf", accessoryColor:"cream"},
  desert: {jacket:"sand", trousers:"charcoal", accessory:"cap", accessoryColor:"ochre"},
  mystic: {jacket:"violet", trousers:"charcoal", accessory:"satchel", accessoryColor:"ice"},
  mono: {jacket:"cream", trousers:"charcoal", accessory:"none", accessoryColor:"ocean"},
};

export function resolveAvatarStyle(spec = {}) {
  const variant = Number(spec.variant) || 0;
  const fallback = paletteOutfits[spec.palette] || paletteOutfits.natural;
  const accessoryFallbacks = [...new Set([fallback.accessory, "none", "scarf", "cap", "satchel", "backpack"])];
  const style = spec.avatar || {};
  const validColor = value => avatarColors[value] ? value : null;
  const validAccessory = value => ["none", "backpack", "scarf", "cap", "satchel"].includes(value) ? value : null;
  return {
    jacket: validColor(style.jacket) || fallback.jacket,
    trousers: validColor(style.trousers) || fallback.trousers,
    accessory: validAccessory(style.accessory) || accessoryFallbacks[Math.max(0, variant - 1) % accessoryFallbacks.length],
    accessoryColor: validColor(style.accessoryColor) || fallback.accessoryColor,
    skin: [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d][variant % 4],
    hair: [0x171310, 0x35231a, 0x603b26, 0x241d1a][Math.floor(variant / 4) % 4],
  };
}

export function nextExploreView(view) {
  return ({third: "first", first: "overview", overview: "third"})[view] || "third";
}

export function normalizeControlCode(event) {
  const code = event.code || ({
    w: "KeyW", W: "KeyW", a: "KeyA", A: "KeyA", s: "KeyS", S: "KeyS", d: "KeyD", D: "KeyD",
    ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
    " ": "Space", Shift: "ShiftLeft", v: "KeyV", V: "KeyV",
    m: "KeyM", M: "KeyM",
  })[event.key];
  return ({ArrowUp: "KeyW", ArrowDown: "KeyS", ArrowLeft: "KeyA", ArrowRight: "KeyD"})[code] || code;
}

export function collidesWithScene(x, z, items, radius = .34) {
  return items.some(item => solidGroups.has(item.group) &&
    Math.abs(x - item.x) < item.width / 2 + radius &&
    Math.abs(z - item.z) < item.depth / 2 + radius);
}

export function findPlayerSpawn(layout, heightAt, radius = .34) {
  const preferredZ = Math.min(5, layout.landRadius * .3);
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const distance = attempt ? Math.sqrt(attempt) * .55 : 0;
    const angle = attempt * 2.399;
    const x = Math.cos(angle) * distance;
    const z = preferredZ + Math.sin(angle) * distance;
    if (Math.hypot(x, z) > layout.landRadius * .85) continue;
    if (!collidesWithScene(x, z, layout.items, radius + .18)) {
      return { x, y: heightAt(x, z), z };
    }
  }
  return { x: 0, y: heightAt(0, preferredZ), z: preferredZ };
}

export function isExploreCheckpointUsable(checkpoint, world, radius = .34) {
  if (!checkpoint || !world?.layout || ![checkpoint.x, checkpoint.z, checkpoint.yaw, checkpoint.pitch].every(Number.isFinite)) return false;
  const maxRadius = Math.max(12, world.layout.landRadius * 1.25);
  return Math.hypot(checkpoint.x, checkpoint.z) <= maxRadius &&
    !collidesWithScene(checkpoint.x, checkpoint.z, world.layout.items, radius);
}

export function avatarScaleForLayout(layout = {}) {
  const requested = Number(layout.avatarScale);
  return Number.isFinite(requested) && requested > 0
    ? THREE.MathUtils.clamp(requested, .45, 1.25)
    : 1;
}

function standardMaterial(color, roughness = .78) {
  return new THREE.MeshStandardMaterial({color, roughness, metalness: .02});
}

function part(geometry, material, parent, position) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function makeLimb({x, y, material, shoe = false}) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  part(new THREE.CapsuleGeometry(.105, .25, 3, 6), material, pivot, [0, -.22, 0]);
  const joint = new THREE.Group();
  joint.position.y = -.43;
  pivot.add(joint);
  part(new THREE.CapsuleGeometry(.095, .23, 3, 6), material, joint, [0, -.2, 0]);
  if (shoe) part(new THREE.BoxGeometry(.2, .12, .32), standardMaterial(0x20252a), joint, [0, -.43, -.07]);
  pivot.userData.joint = joint;
  return pivot;
}

export function createPlayerAvatar() {
  const avatar = new THREE.Group();
  avatar.name = "explorer-avatar";
  const rig = new THREE.Group();
  avatar.add(rig);
  const jacket = standardMaterial(0xe36d43, .65);
  const trousers = standardMaterial(0x273c55);
  const skin = standardMaterial(0xc98f68, .82);
  const hair = standardMaterial(0x2a201c, .92);
  const accessoryMaterial = standardMaterial(0x455d3e, .9);

  part(new THREE.CapsuleGeometry(.29, .48, 5, 8), jacket, rig, [0, 1.18, 0]);
  const accessories = {
    backpack: part(new THREE.BoxGeometry(.48, .58, .19), accessoryMaterial, rig, [0, 1.2, .28]),
    scarf: new THREE.Group(), cap: new THREE.Group(), satchel: new THREE.Group(),
  };
  const scarfRing = part(new THREE.TorusGeometry(.255, .055, 5, 14), accessoryMaterial, accessories.scarf, [0, 1.61, 0]);
  scarfRing.rotation.x = Math.PI / 2;
  const scarfTail = part(new THREE.BoxGeometry(.12, .42, .045), accessoryMaterial, accessories.scarf, [.12, 1.4, -.27]);
  scarfTail.rotation.z = -.12;
  part(new THREE.CylinderGeometry(.25, .27, .13, 12), accessoryMaterial, accessories.cap, [0, 2.02, 0]);
  part(new THREE.BoxGeometry(.38, .045, .3), accessoryMaterial, accessories.cap, [0, 1.98, -.18]);
  const satchelBag = part(new THREE.BoxGeometry(.34, .34, .17), accessoryMaterial, accessories.satchel, [.36, .98, .15]);
  satchelBag.rotation.z = -.08;
  const satchelStrap = part(new THREE.BoxGeometry(.045, 1.03, .04), accessoryMaterial, accessories.satchel, [.02, 1.38, .12]);
  satchelStrap.rotation.z = -.58;
  rig.add(accessories.scarf, accessories.cap, accessories.satchel);
  part(new THREE.SphereGeometry(.255, 12, 9), skin, rig, [0, 1.82, 0]);
  const hairMesh = part(new THREE.SphereGeometry(.264, 12, 7, 0, Math.PI * 2, 0, Math.PI * .57), hair, rig, [0, 1.88, .005]);
  hairMesh.scale.z = 1.02;
  const eyeWhite = standardMaterial(0xf5f1e7, .7);
  const eyeDark = standardMaterial(0x191818, .68);
  for (const x of [-.085, .085]) {
    const white = part(new THREE.SphereGeometry(.052, 8, 6), eyeWhite, rig, [x, 1.85, -.225]);
    white.name = "avatar-eye";
    white.scale.z = .38;
    const pupil = part(new THREE.SphereGeometry(.024, 7, 5), eyeDark, rig, [x, 1.85, -.269]);
    pupil.name = "avatar-pupil";
    pupil.scale.z = .32;
    const brow = part(new THREE.BoxGeometry(.09, .018, .018), hair, rig, [x, 1.925, -.226]);
    brow.name = "avatar-brow";
    brow.rotation.z = x < 0 ? -.1 : .1;
  }
  const nose = part(new THREE.ConeGeometry(.038, .09, 6), skin, rig, [0, 1.79, -.255]);
  nose.name = "avatar-nose";
  nose.rotation.x = -Math.PI / 2;
  const mouth = part(new THREE.BoxGeometry(.115, .018, .018), eyeDark, rig, [0, 1.715, -.245]);
  mouth.name = "avatar-mouth";

  const leftArm = makeLimb({x: .37, y: 1.48, material: jacket});
  const rightArm = makeLimb({x: -.37, y: 1.48, material: jacket});
  const leftLeg = makeLimb({x: .17, y: .83, material: trousers, shoe: true});
  const rightLeg = makeLimb({x: -.17, y: .83, material: trousers, shoe: true});
  rig.add(leftArm, rightArm, leftLeg, rightLeg);
  leftArm.rotation.z = -.08;
  rightArm.rotation.z = .08;
  avatar.userData.rig = {rig, leftArm, rightArm, leftLeg, rightLeg};
  avatar.userData.outfit = {jacket, trousers, skin, hair, accessoryMaterial, accessories};
  avatar.visible = false;
  return avatar;
}

export function applyAvatarStyle(avatar, spec) {
  const style = resolveAvatarStyle(spec);
  const outfit = avatar.userData.outfit;
  outfit.jacket.color.setHex(avatarColors[style.jacket]);
  outfit.trousers.color.setHex(avatarColors[style.trousers]);
  outfit.accessoryMaterial.color.setHex(avatarColors[style.accessoryColor]);
  outfit.skin.color.setHex(style.skin);
  outfit.hair.color.setHex(style.hair);
  for (const [name, object] of Object.entries(outfit.accessories)) object.visible = name === style.accessory;
  avatar.userData.style = style;
  return style;
}

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function dampAngle(current, target, smoothing, delta) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-smoothing * delta));
}

export function createExplorer({ canvas, camera, controls, scene, stage, hud, button, getWorld, onActiveChange, onStatus }) {
  const keys = new Set();
  let avatarScale = 1;
  let eyeHeight = 1.65;
  let playerRadius = .34;
  const player = new THREE.Vector3();
  const avatar = createPlayerAvatar();
  scene.add(avatar);
  const viewButton = hud.querySelector("[data-view-toggle]");
  const musicButton = hud.querySelector("[data-music-toggle]");
  const viewLabel = hud.querySelector("[data-view-label]");
  const music=createSceneMusic({onStateChange:state=>{
    if(musicButton)musicButton.textContent=(state.enabled?"Music on":"Music off")+" · M";
    stage.dataset.music=state.active?(state.profile||"ambient"):"off";
  }});
  let active = false;
  let view = "third";
  let yaw = 0;
  let pitch = 0;
  let jumpHeight = 0;
  let verticalSpeed = 0;
  let grounded = true;
  let gaitPhase = 0;
  let saved = null;
  let checkpoint = null;

  function worldState() {
    const value = getWorld();
    return value?.layout && value?.landscape ? value : null;
  }

  function updateViewLabel() {
    const label = viewLabels[view];
    if (viewLabel) viewLabel.textContent = label;
    if (viewButton) {
      viewButton.textContent = `${label} · V`;
      viewButton.setAttribute("aria-label", `Switch from ${label.toLowerCase()}`);
    }
    stage.dataset.exploreView = view;
  }

  function applyView(delta = 1, snap = false) {
    avatar.visible = active && view !== "first";
    if (view === "first") {
      camera.position.set(player.x, player.y + eyeHeight + jumpHeight, player.z);
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch, yaw, 0);
      return;
    }
    const focus = new THREE.Vector3(player.x, player.y + 1.18 * avatarScale + jumpHeight, player.z);
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const overview = view === "overview";
    const desired = focus.clone().addScaledVector(forward, overview ? -11 : -5.4);
    desired.y += overview ? 6.5 + pitch * 2 : 2.05 + pitch * 2.7;
    camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-12 * delta));
    camera.lookAt(focus.addScaledVector(forward, overview ? 2.2 : .45));
  }

  function toggleView() {
    if (!active) return;
    view = nextExploreView(view);
    camera.fov = view === "first" ? 68 : 58;
    camera.updateProjectionMatrix();
    updateViewLabel();
    applyView(1, true);
    onStatus(`${viewLabels[view]} view · V switches camera`);
  }

  function begin() {
    const world = worldState();
    if (!world || active) return;
    avatarScale = avatarScaleForLayout(world.layout);
    eyeHeight = 1.65 * avatarScale;
    playerRadius = .34 * avatarScale;
    avatar.scale.setScalar(avatarScale);
    stage.dataset.avatarScale = avatarScale.toFixed(2);
    saved = {
      position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      fov: camera.fov, near: camera.near, target: controls.target.clone(),
    };
    const avatarStyle = applyAvatarStyle(avatar, world.spec);
    stage.dataset.avatar = JSON.stringify(avatarStyle);
    const resume = isExploreCheckpointUsable(checkpoint, world, playerRadius);
    if (resume) {
      player.set(checkpoint.x, world.landscape.heightAt(checkpoint.x, checkpoint.z), checkpoint.z);
      yaw = checkpoint.yaw;
      pitch = checkpoint.pitch;
      view = viewLabels[checkpoint.view] ? checkpoint.view : "third";
    } else {
      const spawn = findPlayerSpawn(world.layout, world.landscape.heightAt, playerRadius);
      player.set(spawn.x, spawn.y, spawn.z);
      camera.position.set(spawn.x, spawn.y + eyeHeight, spawn.z);
      camera.lookAt(new THREE.Vector3(0, spawn.y + 1.1, 0));
      yaw = camera.rotation.y;
      pitch = 0;
      view = "third";
    }
    camera.fov = view === "first" ? 68 : 58;
    camera.near = .08;
    camera.updateProjectionMatrix();
    jumpHeight = 0;
    verticalSpeed = 0;
    gaitPhase = 0;
    grounded = true;
    active = true;
    music.start(world.spec);
    controls.enabled = false;
    keys.clear();
    avatar.position.copy(player);
    avatar.rotation.y = resume && Number.isFinite(checkpoint.facing) ? checkpoint.facing : yaw;
    stage.classList.add("exploring");
    hud.hidden = false;
    button.setAttribute("aria-pressed", "true");
    updateViewLabel();
    onActiveChange(true);
    applyView(1, true);
    if (typeof canvas.requestPointerLock === "function") {
      Promise.resolve(canvas.requestPointerLock()).catch(() => end());
    }
  }

  function end() {
    if (!active) return;
    checkpoint = {
      x: player.x, z: player.z, yaw, pitch, view,
      facing: avatar.rotation.y,
    };
    stage.dataset.exploreCheckpoint = JSON.stringify(checkpoint);
    active = false;
    music.end();
    keys.clear();
    avatar.visible = false;
    stage.classList.remove("exploring");
    hud.hidden = true;
    button.setAttribute("aria-pressed", "false");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (saved) {
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      camera.fov = saved.fov;
      camera.near = saved.near;
      camera.updateProjectionMatrix();
      controls.target.copy(saved.target);
    }
    controls.enabled = true;
    controls.update();
    onActiveChange(false);
    onStatus("Exploration ended · scene editing restored");
  }

  button.addEventListener("click", () => {
    if (!document.pointerLockElement && !active) begin();
    else if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  hud.querySelector("[data-explore-exit]").addEventListener("click", end);
  viewButton?.addEventListener("click", toggleView);
  musicButton?.addEventListener("click",()=>{
    const enabled=music.toggle();
    onStatus(enabled?"Scene music enabled":"Scene music muted");
  });

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      onStatus("Exploring · WASD / arrows move · Space jump · V view · Esc exit");
      return;
    }
    if (active) end();
  });
  document.addEventListener("pointerlockerror", () => {
    onStatus("Click Explore again to capture the mouse", true);
    end();
  });
  document.addEventListener("mousemove", event => {
    if (!active || document.pointerLockElement !== canvas) return;
    yaw -= event.movementX * .0022;
    pitch -= event.movementY * .0022;
    const pitchLimits = view === "first" ? [-Math.PI * .47, Math.PI * .47] : view === "overview" ? [-.25, .35] : [-.38, .52];
    pitch = THREE.MathUtils.clamp(pitch, ...pitchLimits);
    applyView(1 / 60);
  });
  document.addEventListener("keydown", event => {
    if (!active || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return;
    const code = normalizeControlCode(event);
    if (movementCodes.has(code)) {
      event.preventDefault();
      keys.add(code);
    }
    if (code === "KeyV" && !event.repeat) {
      event.preventDefault();
      toggleView();
    }
    if(code==="KeyM"&&!event.repeat){
      event.preventDefault();
      const enabled=music.toggle();
      onStatus(enabled?"Scene music enabled":"Scene music muted");
    }
    if (code === "Space" && grounded) {
      grounded = false;
      verticalSpeed = 5.4;
    }
  });
  document.addEventListener("keyup", event => keys.delete(normalizeControlCode(event)));
  window.addEventListener("blur", () => keys.clear());

  function animateAvatar(delta, moved, running) {
    const {rig, leftArm, rightArm, leftLeg, rightLeg} = avatar.userData.rig;
    if (moved) gaitPhase += delta * (running ? 11.5 : 8.2);
    const stride = moved && grounded ? Math.sin(gaitPhase) * (running ? .82 : .56) : 0;
    const bounce = moved && grounded ? Math.abs(Math.sin(gaitPhase * 2)) * (running ? .055 : .035) : 0;
    const legTarget = grounded ? stride : -.38;
    leftLeg.rotation.x = damp(leftLeg.rotation.x, legTarget, 14, delta);
    rightLeg.rotation.x = damp(rightLeg.rotation.x, grounded ? -stride : .28, 14, delta);
    leftArm.rotation.x = damp(leftArm.rotation.x, grounded ? -stride * .78 : -1.05, 13, delta);
    rightArm.rotation.x = damp(rightArm.rotation.x, grounded ? stride * .78 : -1.05, 13, delta);
    leftLeg.userData.joint.rotation.x = damp(leftLeg.userData.joint.rotation.x, grounded ? Math.max(0, -stride) * .48 : .82, 14, delta);
    rightLeg.userData.joint.rotation.x = damp(rightLeg.userData.joint.rotation.x, grounded ? Math.max(0, stride) * .48 : .65, 14, delta);
    leftArm.userData.joint.rotation.x = damp(leftArm.userData.joint.rotation.x, grounded ? -.16 : -.32, 12, delta);
    rightArm.userData.joint.rotation.x = damp(rightArm.userData.joint.rotation.x, grounded ? -.16 : -.32, 12, delta);
    rig.position.y = damp(rig.position.y, bounce, 18, delta);
    rig.rotation.x = damp(rig.rotation.x, moved && grounded ? (running ? -.12 : -.055) : 0, 10, delta);
  }

  function update(delta) {
    if (!active) return;
    const world = worldState();
    if (!world) { end(); return; }
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const right = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const length = Math.hypot(forward, right) || 1;
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = running ? 7.2 : 4.2;
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length * speed * delta;
    const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length * speed * delta;
    const beforeX = player.x;
    const beforeZ = player.z;
    const maxRadius = Math.max(12, world.layout.landRadius * 1.25);
    const currentGround = world.landscape.heightAt(player.x, player.z);
    const tryAxis = (axis, amount) => {
      const x = axis === "x" ? player.x + amount : player.x;
      const z = axis === "z" ? player.z + amount : player.z;
      const ground = world.landscape.heightAt(x, z);
      if (Math.hypot(x, z) > maxRadius || Math.abs(ground - currentGround) > .65) return;
      if (collidesWithScene(x, z, world.layout.items, playerRadius)) return;
      player[axis] += amount;
    };
    tryAxis("x", dx);
    tryAxis("z", dz);

    verticalSpeed -= 14.5 * delta;
    jumpHeight += verticalSpeed * delta;
    if (jumpHeight <= 0) {
      jumpHeight = 0;
      verticalSpeed = 0;
      grounded = true;
    }
    player.y = world.landscape.heightAt(player.x, player.z);
    const moved = Math.hypot(player.x - beforeX, player.z - beforeZ) > .0001;
    if (moved) {
      const facing = Math.atan2(-(player.x - beforeX), -(player.z - beforeZ));
      avatar.rotation.y = dampAngle(avatar.rotation.y, facing, 14, delta);
    }
    avatar.position.set(player.x, player.y + jumpHeight, player.z);
    animateAvatar(delta, moved, running);
    applyView(delta);
    stage.dataset.player = JSON.stringify({
      x: Number(player.x.toFixed(3)), y: Number((player.y + jumpHeight).toFixed(3)),
      z: Number(player.z.toFixed(3)), grounded, moving: moved, view,
    });
  }

  function reset() {
    music.end();
    checkpoint = null;
    delete stage.dataset.exploreCheckpoint;
  }

  return { begin, end, reset, toggleView, update, get active() { return active; }, get view() { return view; } };
}
