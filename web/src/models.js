import * as THREE from "three";
import { createExtraAsset } from "./assets.js";
import { createLibraryAsset } from "./library.js";
import catalog from "../../scene/catalog.json" with { type: "json" };
export { catalog };
const definitions = new Map(catalog.map(item => [item.type, item]));
export const assetDefinition = type => definitions.get(type);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.8,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function mesh(geometry, mat, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function makeTent(colors) {
  const group = new THREE.Group();
  const body = mesh(new THREE.ConeGeometry(1.25, 1.65, 4), material(colors.fabric), 0, 0.83, 0);
  body.rotation.y = Math.PI / 4;
  body.scale.z = 0.82;
  group.add(body);
  const door = mesh(new THREE.ConeGeometry(0.44, 0.8, 3), material(0x2a2420), 0, 0.42, 0.91);
  door.rotation.z = Math.PI;
  group.add(door);
  return group;
}

function makeCabin(colors) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(2.4, 1.35, 1.8), material(colors.wood), 0, 0.68, 0));
  const roof = mesh(new THREE.ConeGeometry(1.75, 0.9, 4), material(0x363b3b), 0, 1.72, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.78;
  group.add(roof);
  group.add(mesh(new THREE.BoxGeometry(0.55, 0.9, 0.08), material(0x30251f), 0, 0.47, 0.94));
  const windowMat = material(0xffcf74, { emissive: 0xff9b32, emissiveIntensity: 0.65 });
  group.add(mesh(new THREE.BoxGeometry(0.45, 0.4, 0.08), windowMat, -0.72, 0.78, 0.94));
  return group;
}

function makeCampfire(colors) {
  const group = new THREE.Group();
  for (let index = 0; index < 3; index += 1) {
    const log = mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.35, 7), material(colors.wood), 0, 0.18, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (Math.PI / 3) * index;
    group.add(log);
  }
  const flame = mesh(
    new THREE.ConeGeometry(0.48, 1.15, 7),
    material(0xff9f38, { emissive: 0xff5d16, emissiveIntensity: 2.2 }),
    0,
    0.82,
    0,
  );
  flame.userData.flame = true;
  group.add(flame);
  const light = new THREE.PointLight(0xff8a35, 18, 9, 2);
  light.position.set(0, 1.25, 0);
  light.castShadow = true;
  group.add(light);
  return group;
}

function makePine(colors, random) {
  const group = new THREE.Group();
  const height = 1.1 + random() * 0.8;
  group.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 7), material(colors.wood), 0, height / 2, 0));
  for (let index = 0; index < 3; index += 1) {
    const cone = mesh(
      new THREE.ConeGeometry(0.82 - index * 0.13, 1.3, 8),
      material(colors.leaf),
      0,
      height * 0.62 + index * 0.52,
      0,
    );
    group.add(cone);
  }
  return group;
}

function makeRock(colors, random) {
  const rock = mesh(new THREE.DodecahedronGeometry(0.55 + random() * 0.32, 0), material(colors.stone), 0, 0.42, 0);
  rock.scale.y = 0.7 + random() * 0.35;
  rock.rotation.set(random(), random(), random());
  return rock;
}

function makeTable(colors) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(1.8, 0.16, 1.05), material(colors.wood), 0, 0.9, 0));
  for (const x of [-0.68, 0.68]) {
    for (const z of [-0.35, 0.35]) {
      group.add(mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), material(colors.wood), x, 0.45, z));
    }
  }
  return group;
}

function makeLantern(colors) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 7), material(0x31373a, { metalness: 0.5 }), 0, 0.85, 0));
  const bulb = mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    material(colors.accent, { emissive: colors.accent, emissiveIntensity: 2.4 }),
    0,
    1.52,
    0,
  );
  group.add(bulb);
  const light = new THREE.PointLight(colors.accent, 6, 5, 2);
  light.position.y = 1.52;
  group.add(light);
  return group;
}

function makePond() {
  const water = mesh(
    new THREE.CylinderGeometry(1.6, 1.7, 0.12, 32),
    material(0x5aacc4, { roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.78 }),
    0,
    0.06,
    0,
  );
  water.receiveShadow = true;
  return water;
}

function makeCrystal(colors, random) {
  const crystal = mesh(
    new THREE.OctahedronGeometry(0.48 + random() * 0.28, 0),
    material(colors.accent, { roughness: 0.18, emissive: colors.accent, emissiveIntensity: 1.15 }),
    0,
    0.7,
    0,
  );
  crystal.scale.y = 1.7 + random();
  crystal.userData.float = true;
  return crystal;
}

function makeMonolith(colors) {
  const group = new THREE.Group();
  const stone = mesh(new THREE.BoxGeometry(1.2, 4.2, 0.75), material(colors.stone, { roughness: 0.48 }), 0, 2.1, 0);
  stone.rotation.y = 0.18;
  group.add(stone);
  const line = mesh(
    new THREE.BoxGeometry(0.05, 2.5, 0.78),
    material(colors.accent, { emissive: colors.accent, emissiveIntensity: 1.6 }),
    0,
    2.2,
    0,
  );
  line.rotation.y = 0.18;
  group.add(line);
  return group;
}

function makeWindmill(colors) {
  const group = new THREE.Group();
  const tower = mesh(new THREE.CylinderGeometry(0.55, 0.9, 3.1, 8), material(colors.fabric), 0, 1.55, 0);
  group.add(tower);
  const hub = mesh(new THREE.SphereGeometry(0.18, 10, 8), material(colors.wood), 0, 2.65, 0.72);
  group.add(hub);
  const blades = new THREE.Group();
  blades.position.set(0, 2.65, 0.78);
  for (let index = 0; index < 4; index += 1) {
    const blade = mesh(new THREE.BoxGeometry(0.17, 1.55, 0.07), material(colors.wood), 0, 0.78, 0);
    const pivot = new THREE.Group();
    pivot.rotation.z = (Math.PI / 2) * index;
    pivot.add(blade);
    blades.add(pivot);
  }
  blades.userData.spin = true;
  group.add(blades);
  return group;
}

function makeRobot(colors) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.65, 0.65), material(0xdce3e3, { metalness: 0.35 }), 0, 0.85, 0));
  const eyeMat = material(colors.accent, { emissive: colors.accent, emissiveIntensity: 2 });
  group.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat, -0.22, 0.92, 0.34));
  group.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat, 0.22, 0.92, 0.34));
  for (const x of [-0.3, 0.3]) {
    group.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 10), material(0x33383c), x, 0.32, 0));
  }
  const antenna = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48, 6), material(0x525c61), 0, 1.42, 0);
  group.add(antenna);
  group.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat, 0, 1.68, 0));
  return group;
}

function rawAsset(type, colors, random) {
  const detailed = createLibraryAsset(type, { colors, random, mesh, material });
  if (detailed) return detailed;
  const extra = createExtraAsset(type, { colors, random, mesh, material });
  if (extra) return extra;
  const factories = {
    tent: () => makeTent(colors),
    cabin: () => makeCabin(colors),
    campfire: () => makeCampfire(colors),
    pine: () => makePine(colors, random),
    rock: () => makeRock(colors, random),
    table: () => makeTable(colors),
    lantern: () => makeLantern(colors),
    pond: () => makePond(),
    crystal: () => makeCrystal(colors, random),
    monolith: () => makeMonolith(colors),
    windmill: () => makeWindmill(colors),
    robot: () => makeRobot(colors),
  };
  if (!factories[type]) throw new Error("Unsupported asset: " + type);
  return factories[type]();
}


export { material, mesh };
export function createAsset(type, colors, random) {
  const definition = definitions.get(type);
  if (!definition) throw new Error("Unknown catalog asset: " + type);
  const content = rawAsset(type === "person" ? (random() < .5 ? "man" : "woman") : type, colors, random);
  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  // Uniform normalization preserves the silhouette and a shared toy-world scale.
  const height = definition.height * (definition.group === "architecture" ? .93 + random() * .14 : 1);
  const scale = height / Math.max(size.y, .001);
  const normalized = new THREE.Group();
  normalized.add(content);
  normalized.scale.setScalar(scale);
  normalized.position.y = -bounds.min.y * scale;
  const wrapper = new THREE.Group();
  wrapper.add(normalized);
  wrapper.userData.assetType = type;
  wrapper.userData.group = definition.group;
  return wrapper;
}
