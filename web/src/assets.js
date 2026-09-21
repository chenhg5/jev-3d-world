import * as THREE from "three";

// Procedural assets: every factory returns a ground-aligned, editable group.
// Shared materials and geometry helpers keep the scene grammar easy to extend.
export function createExtraAsset(type, { colors, random, mesh, material }) {
  const group = new THREE.Group();
  const mat = (color, options) => material(color, options);
  const box = (w, h, d, color, x = 0, y = h / 2, z = 0) => {
    const node = mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z);
    group.add(node); return node;
  };
  const cylinder = (top, bottom, height, color, x = 0, y = height / 2, z = 0, sides = 12) => {
    const node = mesh(new THREE.CylinderGeometry(top, bottom, height, sides), mat(color), x, y, z);
    group.add(node); return node;
  };
  const ball = (radius, color, x, y, z) => {
    const node = mesh(new THREE.IcosahedronGeometry(radius, 1), mat(color), x, y, z);
    group.add(node); return node;
  };
  const roof = (width, baseY, depth = width) => {
    // Swept eaves: the outer corners lift above the middle of each edge.
    const rings = [[1, 0], [0.72, 0.12], [0.4, 0.58], [0.02, 0.88]];
    const vertices = [];
    const point = (ring, side) => {
      const a = side * Math.PI / 2 + Math.PI / 4;
      return [Math.cos(a) * width * ring[0] * 0.71, baseY + ring[1] * width * 0.45,
        Math.sin(a) * depth * ring[0] * 0.71];
    };
    for (let level = 0; level < rings.length - 1; level++) {
      for (let side = 0; side < 4; side++) {
        const a = point(rings[level], side), b = point(rings[level], side + 1);
        const c = point(rings[level + 1], side + 1), d = point(rings[level + 1], side);
        vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const roofMaterial = mat(0x326567); roofMaterial.side = THREE.DoubleSide;
    group.add(mesh(geometry, roofMaterial));
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const eave = box(0.12, 0.16, 0.55, 0x426d66, x * width * 0.45, baseY + 0.09, z * depth * 0.46);
      eave.rotation.x = z * -0.35;
    }
  };

  if (type === "tree") {
    const height = 1.2 + random() * 0.7;
    cylinder(0.11, 0.18, height, colors.wood);
    for (let i = 0; i < 4; i++) {
      const color = new THREE.Color(colors.leaf).offsetHSL((random() - 0.5) * 0.035, 0, random() * 0.12).getHex();
      ball(0.6 + random() * 0.35, color, (random() - 0.5) * 0.8, height + random() * 0.7, (random() - 0.5) * 0.8);
    }
  } else if (type === "palm") {
    cylinder(0.1, 0.2, 2.7, 0x9a734d);
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(new THREE.SphereGeometry(1, 8, 6), mat(0x3f8054));
      leaf.scale.set(0.22, 0.08, 1.4);
      const angle = i * Math.PI * 2 / 7;
      leaf.position.set(Math.sin(angle) * 0.7, 2.7, Math.cos(angle) * 0.7);
      leaf.rotation.set(0.2, angle, 0);
      group.add(leaf);
    }
    ball(0.18, 0x715238, 0.1, 2.5, 0.1);
  } else if (type === "pavilion" || type === "hall" || type === "pagoda") {
    const levels = type === "pagoda" ? 3 : 1;
    const width = type === "hall" ? 3.5 : 2.6;
    box(width, 0.2, 2.6, 0xb8b4a3);
    for (let level = 0; level < levels; level++) {
      const w = width * (1 - level * 0.17), base = level * 1.45 + 0.2;
      if (type !== "pavilion") box(w * 0.77, 1.25, w * 0.64, 0xecd9b8, 0, base + 0.62);
      for (const x of [-1, 1]) for (const z of [-1, 1]) cylinder(0.09, 0.09, 1.5, 0xa33b32, x * w * 0.34, base + 0.7, z * w * 0.3);
      box(w * 0.85, 0.1, 0.12, 0xa33b32, 0, base + 1.2, w * 0.33);
      if (type !== "pavilion") {
        box(0.4, 0.9, 0.07, 0x754531, 0, base + 0.45, w * 0.33);
        for (const x of [-0.7, 0.7]) box(0.36, 0.42, 0.06, 0x426567, x * w / 2.6, base + 0.75, w * 0.33);
      }
      roof(w * 1.25, base + 1.4);
    }
    cylinder(0.02, 0.08, 0.55, 0xd6b968, 0, levels * 1.45 + 1.05);
  } else if (type === "bridge") {
    for (let i = 0; i < 13; i++) {
      const x = (i - 6) * 0.27, y = 0.22 + Math.cos((i - 6) / 6 * Math.PI / 2) * 0.6;
      box(0.3, 0.15, 1.2, 0xb7b3a1, x, y);
      for (const z of [-0.6, 0.6]) {
        box(0.07, 0.42, 0.07, 0xab5642, x, y + 0.25, z);
        box(0.32, 0.09, 0.08, 0xab5642, x, y + 0.47, z);
      }
    }
  } else if (type === "train") {
    for (let i = 0; i < 23; i++) box(0.14, 0.08, 1.35, 0x725640, (i - 11) * 0.34, 0.04);
    for (const z of [-0.45, 0.45]) box(8, 0.09, 0.07, 0x889293, 0, 0.13, z);
    for (let car = 0; car < 3; car++) {
      const x = (car - 1) * 2.2;
      box(1.95, 0.25, 0.95, 0x29373e, x, 0.43);
      box(1.8, car === 0 ? 0.8 : 1.05, 0.87, car === 0 ? 0xc34f3e : 0xd1aa63, x, 1.02);
      box(1.95, 0.15, 1, 0x31494f, x, 1.6);
      for (const dx of [-0.52, 0.05, 0.6]) for (const z of [-0.445, 0.445]) box(0.37, 0.38, 0.025, 0x92d2d9, x + dx, 1.15, z);
      for (const dx of [-0.65, 0.65]) for (const z of [-0.51, 0.51]) {
        const wheel = cylinder(0.23, 0.23, 0.12, 0x26343b, x + dx, 0.33, z);
        wheel.rotation.x = Math.PI / 2;
      }
    }
    cylinder(0.17, 0.13, 0.6, 0x344448, -2.75, 1.85);
    ball(0.27, 0xe1e3df, -2.75, 2.45, 0);
  } else if (type === "station") {
    box(4, 0.22, 2.2, 0xb6b1a2);
    box(2, 1.5, 1.2, 0xd7b77e, -0.6, 0.98);
    box(4.2, 0.18, 2.3, 0x435b61, 0, 2.05);
    for (const x of [-1.75, 1.75]) cylinder(0.07, 0.07, 1.8, 0x57666b, x, 1.1, 0.9);
    box(0.5, 0.9, 0.05, 0x486779, -0.6, 0.72, 0.63);
  } else if (["building", "round_tower", "tapered_tower"].includes(type)) {
    const height = 3 + random() * 5, width = 1.2 + random() * 1.1;
    const wall = new THREE.Color().setHSL(0.53 + random() * 0.09, 0.13 + random() * 0.15, 0.4 + random() * 0.28).getHex();
    if (type === "round_tower") {
      cylinder(width * 0.52, width * 0.52, height, wall, 0, height / 2, 0, 24);
      for (let y = 0.45; y < height; y += 0.43) cylinder(width * 0.535, width * 0.535, 0.12, 0xa6d5dc, 0, y, 0, 24);
    } else if (type === "tapered_tower") {
      for (let level = 0; level < 5; level++) {
        const w = width * (1 - level * 0.14);
        box(w, height / 5, w, wall, 0, (level + 0.5) * height / 5);
        box(w + 0.03, 0.1, w + 0.03, 0xc3e5e2, 0, (level + 1) * height / 5);
      }
    } else {
      box(width, height, width * 0.78, wall);
      for (let y = 0.5; y < height - 0.2; y += 0.55) for (const x of [-0.28, 0, 0.28]) {
        for (const z of [-1, 1]) box(width * 0.16, 0.3, 0.035, random() < 0.2 ? 0xf4d996 : 0x8ed0df, x * width, y, z * width * 0.398);
      }
    }
    cylinder(0.02, 0.025, 0.6, 0xced8d9, 0, height + 0.25);
  } else if (type === "house") {
    box(1.9, 1.5, 1.7, 0xe5d1a4);
    const top = mesh(new THREE.ConeGeometry(1.6, 1, 4), mat(0xb2694c), 0, 1.94, 0);
    top.rotation.y = Math.PI / 4; group.add(top);
    box(0.4, 0.9, 0.08, 0x72523b, 0, 0.45, 0.88);
    for (const x of [-0.6, 0.6]) box(0.32, 0.4, 0.08, 0x83beca, x, 0.95, 0.88);
  } else if (["elder", "child", "boy", "girl", "man", "woman"].includes(type)) {
    const child = ["child", "boy", "girl"].includes(type);
    const skin = [0xe4bb98, 0xb67b58, 0x875d45][Math.floor(random() * 3)];
    const shirt = new THREE.Color().setHSL(random(), 0.48, 0.55).getHex();
    cylinder(0.2, 0.24, 0.57, shirt, 0, 0.88);
    for (const x of [-0.12, 0.12]) {
      cylinder(0.07, 0.08, 0.56, 0x344f63, x, 0.29);
      box(0.17, 0.1, 0.28, 0x354047, x, 0.07, 0.05);
    }
    for (const x of [-0.29, 0.29]) {
      const arm = cylinder(0.065, 0.06, 0.52, shirt, x, 0.86); arm.rotation.z = x;
      ball(0.075, skin, x * 1.2, 0.6, 0);
    }
    ball(0.24, skin, 0, 1.4, 0);
    const hair = ball(0.25, type === "elder" ? 0xdfded7 : 0x423126, 0, 1.52, -0.035);
    hair.scale.y = 0.55;
    for (const x of [-0.08, 0.08]) ball(0.023, 0x263238, x, 1.43, 0.22);
    if (type === "girl" || type === "woman") {
      const backHair = ball(0.21, 0x423126, 0, 1.29, -0.15); backHair.scale.y = 1.3;
    }
    if (type === "elder") {
      cylinder(0.025, 0.035, 0.73, 0x7c5137, 0.38, 0.37, 0.17);
      box(0.15, 0.05, 0.055, 0x7c5137, 0.34, 0.76, 0.17);
    }
    if (child) group.scale.setScalar(0.64);
  } else if (type === "mountain" || type === "volcano") {
    const height = 3.3 + random() * 2.2, radius = 2.1 + random();
    cylinder(type === "volcano" ? 0.7 : 0.02, radius, height, type === "volcano" ? 0x65504b : 0x8b9188, 0, height / 2, 0, 9);
    if (type === "mountain") cylinder(0, radius * 0.29, height * 0.3, 0xeaf0ef, 0, height * 0.86, 0, 9);
    else {
      group.add(mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 24), mat(0xff6f19, { emissive: 0xff3600, emissiveIntensity: 2 }), 0, height + 0.02, 0));
      for (let i = 0; i < 4; i++) {
        const smoke = ball(0.35 + i * 0.2, 0x838178, i * 0.18, height + 0.55 + i * 0.52, 0);
        smoke.userData.float = true;
      }
    }
  } else if (type === "boat") {
    const hull = cylinder(0.5, 0.25, 0.42, 0xb16b43, 0, 0.15, 0, 6); hull.scale.set(2.5, 1, 1);
    cylinder(0.03, 0.04, 2.35, 0xddd2ae, 0, 1.26);
    const sailGeometry = new THREE.BufferGeometry();
    sailGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 2.35, 0, 0, 0.65, 0, 1.18, 0.65, 0], 3));
    sailGeometry.computeVertexNormals();
    const sailMaterial = mat(0xf2ebcf); sailMaterial.side = THREE.DoubleSide;
    group.add(mesh(sailGeometry, sailMaterial));
    group.userData.boat = true;
  } else if (type === "lighthouse") {
    cylinder(0.43, 0.7, 3.6, 0xe9e3d4);
    for (const y of [1.3, 2.4]) cylinder(0.7 - y * 0.075, 0.72 - y * 0.075, 0.4, 0xb14e41, 0, y);
    cylinder(0.67, 0.67, 0.15, 0x374d57, 0, 3.65);
    cylinder(0.4, 0.4, 0.5, 0xf2d981, 0, 3.95);
    cylinder(0, 0.68, 0.6, 0xb14e41, 0, 4.5);
  } else return null;
  return group;
}
