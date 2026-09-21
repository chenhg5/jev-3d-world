import * as THREE from "three";

// Ground biomes and time of day are independent: a garden at night has dark sky.
export function skyColor(spec) {
  if (spec.environment === "moon") return 0x090d1c;
  return {
    day: 0x9fcde5,
    sunset: 0xd39888,
    night: 0x101a35,
    overcast: 0x9baab8,
    neon: 0x160e2c,
  }[spec.lighting] ?? 0x9fcde5;
}

export function createMoon(phase) {
  if (!["full", "crescent"].includes(phase)) return null;
  const group = new THREE.Group();
  group.name = "sky-moon";
  const mat = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, fog: false, toneMapped: false, transparent: opacity < 1,
    opacity, depthWrite: false,
  });
  let geometry;
  if (phase === "crescent") {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    shape.absarc(0, 0, 1, -Math.PI / 2, Math.PI / 2, false);
    shape.bezierCurveTo(.9, .5, .9, -.5, 0, -1);
    shape.closePath();
    geometry = new THREE.ShapeGeometry(shape, 48);
  } else {
    geometry = new THREE.CircleGeometry(1, 96);
    for (let i = 3; i > 0; i--) {
      const halo = new THREE.Mesh(new THREE.CircleGeometry(1 + i * .13, 96), mat(0xffedbd, .025));
      halo.position.z = -.01 * i;
      group.add(halo);
    }
  }
  group.add(new THREE.Mesh(geometry, mat(0xffefc6)));
  if (phase === "full") {
    for (const [x, y, r] of [[-.32,.3,.21],[.22,-.27,.27],[.38,.31,.11],[-.43,-.36,.12]]) {
      const crater = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(0xc9bda1, .24));
      crater.position.set(x, y, .01);
      group.add(crater);
    }
  }
  return group;
}

// Place once in world space. Camera orbit, zoom and resize must not move it.
export function positionMoon(moon, landRadius, tallestObject = 0) {
  if (!moon) return;
  moon.position.set(landRadius * .8, tallestObject + landRadius * .7, -landRadius * .85);
  moon.scale.setScalar(Math.max(1, landRadius * .13));
}

// The illustrated lunar disc faces the viewer without changing its sky position.
export function faceMoon(moon, camera) {
  if (!moon) return;
  moon.quaternion.copy(camera.quaternion);
}
