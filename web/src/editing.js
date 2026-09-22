import * as THREE from "three";
import { objectElevation } from "./landscape.js";

// Keep layout coordinates and the rendered model in sync without changing its size or orientation.
export function moveItem(item, x, z, spec, heightAt) {
  item.x = x;
  item.z = z;
  item.model.position.set(x, objectElevation(item, spec, heightAt), z);
  if (item.pool) item.pool.position.set(x, heightAt(x, z) + .05, z);
  item.model.updateMatrixWorld(true);
}

export function transformItem(item, scale, rotation, spec, heightAt) {
  item.editScale = THREE.MathUtils.clamp(scale, .25, 4);
  item.model.scale.copy(item.original.scale).multiplyScalar(item.editScale);
  item.model.rotation.y = rotation;
  item.facing = rotation;
  moveItem(item, item.x, item.z, spec, heightAt);
  const size = new THREE.Box3().setFromObject(item.model).getSize(new THREE.Vector3());
  item.width = size.x; item.depth = size.z; item.height = size.y;
}

export function toolbarPosition(bounds, viewport, size) {
  const margin = 12, top = Math.min(112, viewport.height * .24);
  let x = (bounds.left + bounds.right - size.width) / 2;
  let y = bounds.top - size.height - 14;
  if (y < top) {
    x = bounds.right + 14;
    y = (bounds.top + bounds.bottom - size.height) / 2;
    if (x + size.width > viewport.width - margin) {
      x = bounds.left - size.width - 14;
      if (x < margin) { x = (bounds.left + bounds.right - size.width) / 2; y = bounds.bottom + 14; }
    }
  }
  return {
    x: THREE.MathUtils.clamp(x, margin, Math.max(margin, viewport.width - size.width - margin)),
    y: THREE.MathUtils.clamp(y, top, Math.max(top, viewport.height - size.height - 48)),
  };
}

export function createSceneEditor({ canvas, camera, controls, scene, panel, label, reset, dismiss, remove, scaleInput, rotationInput, onChange, onSelect, onDelete }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const outline = new THREE.BoxHelper(undefined, 0xc5ff91);
  outline.material.depthTest = false;
  outline.material.toneMapped = false;
  outline.renderOrder = 1000;
  outline.visible = false;
  scene.add(outline);
  let items = [], roots = new Map(), selected = null, drag = null, enabled = true;
  let spec, heightAt, limit;
  let hold = null, panelPosition = null;
  const projected = new THREE.Vector3();
  const quickScale = panel.querySelector("#quick-scale");
  const quickRotation = panel.querySelector("#quick-rotation");
  const quickButtons = [...panel.querySelectorAll("[data-transform]")];

  function positionPanel() {
    if (!selected) return;
    const rect = canvas.getBoundingClientRect();
    const parent = panel.offsetParent.getBoundingClientRect();
    const size = {width:panel.offsetWidth,height:panel.offsetHeight};
    const bounds = {left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    const corners = outline.geometry.attributes.position;
    let visible = false;
    for (let i=0;i<corners.count;i++) {
      projected.fromBufferAttribute(corners,i).project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      visible = true;
      const x = (projected.x + 1) * rect.width / 2;
      const y = (1 - projected.y) * rect.height / 2;
      bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);
      bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);
    }
    visible &&= bounds.right>=0 && bounds.left<=rect.width && bounds.bottom>=0 && bounds.top<=rect.height;
    panel.style.visibility = visible ? "visible" : "hidden";
    if (!visible) return;
    // Keep buttons under the pointer as an object grows; follow again on pointer leave.
    if (!panelPosition || (!hold && !panel.matches(":hover"))) panelPosition=toolbarPosition(bounds,rect,size);
    panelPosition.x=THREE.MathUtils.clamp(panelPosition.x,12,Math.max(12,rect.width-size.width-12));
    panelPosition.y=THREE.MathUtils.clamp(panelPosition.y,Math.min(112,rect.height*.24),Math.max(112,rect.height-size.height-48));
    panel.style.transform=`translate3d(${Math.round(panelPosition.x+rect.left-parent.left)}px,${Math.round(panelPosition.y+rect.top-parent.top)}px,0)`;
  }

  function syncPanel() {
    if (!selected) return;
    scaleInput.value = Math.round((selected.editScale ?? 1) * 100);
    const degrees = THREE.MathUtils.radToDeg(selected.model.rotation.y);
    rotationInput.value = Math.round(((degrees % 360) + 360) % 360);
    scaleInput.nextElementSibling.textContent = scaleInput.value + "%";
    rotationInput.nextElementSibling.textContent = rotationInput.value + "°";
    quickScale.textContent = scaleInput.value + "%";
    quickRotation.textContent = rotationInput.value + "°";
    for (const button of quickButtons) button.disabled =
      (button.dataset.transform === "shrink" && selected.editScale <= .25) ||
      (button.dataset.transform === "grow" && selected.editScale >= 4);
    reset.disabled = selected.x === selected.original.x && selected.z === selected.original.z &&
      (selected.editScale ?? 1) === 1 && selected.model.rotation.y === selected.original.rotation;
  }

  function ray(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray;
  }
  function pick(event) {
    ray(event);
    for (const hit of raycaster.intersectObjects(items.map(item => item.model), true)) {
      let node = hit.object;
      while (node && !roots.has(node)) node = node.parent;
      if (node) return roots.get(node);
    }
    return null;
  }
  function select(item) {
    stopHold();
    panelPosition = null;
    selected = item;
    outline.visible = !!item;
    if (!item) outline.object = undefined;
    panel.hidden = !item;
    if (item) {
      label.textContent = item.label;
      outline.setFromObject(item.model);
      syncPanel();
      positionPanel();
    }
    onSelect(item);
  }
  function place(x, z) {
    moveItem(selected, THREE.MathUtils.clamp(x, -limit, limit), THREE.MathUtils.clamp(z, -limit, limit), spec, heightAt);
    outline.setFromObject(selected.model);
    syncPanel();
  }
  function finish(cancel = false) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (cancel) place(previous.start.x, previous.start.z);
    if (canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id);
    controls.enabled = previous.controlsEnabled;
    canvas.classList.remove("is-moving");
    panel.classList.remove("is-dragging");
    if (previous.moved) onChange();
  }
  canvas.addEventListener("pointerdown", event => {
    if (!enabled || event.button !== 0 || !event.isPrimary || event.altKey) return;
    if (drag) return;
    const item = pick(event);
    if (!item) { select(null); return; }
    // Capture before OrbitControls sees the press, so an object drag never rotates the camera.
    event.stopImmediatePropagation();
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    select(item);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -item.model.position.y);
    const point = ray(event).intersectPlane(plane, new THREE.Vector3());
    if (!point) return;
    drag = { id: event.pointerId, plane, offset: point.sub(item.model.position),
      start: { x: item.x, z: item.z }, clientX: event.clientX, clientY: event.clientY,
      moved: false, controlsEnabled: controls.enabled };
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-moving");
  }, true);
  canvas.addEventListener("pointermove", event => {
    if (!enabled) return;
    if (!drag) {
      if (!event.buttons && event.pointerType !== "touch") canvas.classList.toggle("can-move", !!pick(event));
      return;
    }
    event.stopImmediatePropagation();
    if (event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return;
    const point = ray(event).intersectPlane(drag.plane, new THREE.Vector3());
    if (!point) return;
    drag.moved = true;
    panel.classList.add("is-dragging");
    place(point.x - drag.offset.x, point.z - drag.offset.z);
  }, true);
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.stopImmediatePropagation();
      finish(eventName !== "pointerup");
    }, true);
  }
  // Avoid camera zoom changing the drag plane while a pointer is held down.
  canvas.addEventListener("wheel", event => {
    if (drag) { event.stopImmediatePropagation(); event.preventDefault(); }
  }, { capture: true, passive: false });
  window.addEventListener("blur", () => { finish(true); stopHold(); });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") { finish(true); select(null); }
    const target=event.target;
    if (["Delete","Backspace"].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey &&
        target instanceof Element && (target===canvas || panel.contains(target)) &&
        !target.matches("input,textarea,select") && !target.isContentEditable && enabled && selected) {
      event.preventDefault();
      deleteSelected();
    }
  });
  function deleteSelected() {
    if (!enabled || !selected) return;
    finish(true);
    const item=selected;
    select(null);
    items=items.filter(entry=>entry!==item);
    roots.delete(item.model);
    canvas.classList.remove("can-move");
    onDelete(item);
    canvas.focus({preventScroll:true});
  }
  remove.addEventListener("click",deleteSelected);
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "3D scene. Drag an object to move it. Drag empty space to orbit. Use arrow keys to move the selected object.");
  canvas.addEventListener("keydown", event => {
    if (!enabled || !selected || drag || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
    const forward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
    const step = event.shiftKey ? 1 : .25;
    const delta = event.key === "ArrowLeft" ? right.multiplyScalar(-step)
      : event.key === "ArrowRight" ? right.multiplyScalar(step)
      : forward.multiplyScalar(event.key === "ArrowUp" ? step : -step);
    place(selected.x + delta.x, selected.z + delta.z);
    onChange();
  });
  reset.addEventListener("click", () => {
    if (!selected) return;
    finish(true);
    place(selected.original.x, selected.original.z);
    transformItem(selected, 1, selected.original.rotation, spec, heightAt);
    syncPanel();
    onChange();
  });
  for (const input of [scaleInput, rotationInput]) {
    input.addEventListener("input", () => {
      if (!enabled || !selected || drag) return;
      transformItem(selected, Number(scaleInput.value) / 100,
        input === rotationInput ? THREE.MathUtils.degToRad(Number(rotationInput.value)) : selected.model.rotation.y, spec, heightAt);
      syncPanel();
    });
    input.addEventListener("change", () => { if (enabled && selected) onChange(); });
  }
  function quickTransform(action) {
    if (!enabled || !selected || drag) return;
    const scale = selected.editScale ?? 1;
    transformItem(selected,
      action === "grow" ? Math.round((scale+.1)*100)/100 : action === "shrink" ? Math.round((scale-.1)*100)/100 : scale,
      selected.model.rotation.y + (action === "left" ? -Math.PI/12 : action === "right" ? Math.PI/12 : 0), spec, heightAt);
    syncPanel();
  }
  function stopHold() {
    if (!hold) return;
    const previous=hold; hold=null;
    clearTimeout(previous.timer);
    if (previous.button.hasPointerCapture(previous.id)) previous.button.releasePointerCapture(previous.id);
    onChange();
  }
  for (const button of quickButtons) {
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !event.isPrimary || !enabled || !selected || drag) return;
      stopHold();
      event.preventDefault();
      button.focus({preventScroll:true});
      button.setPointerCapture(event.pointerId);
      hold={button,id:event.pointerId,timer:null};
      quickTransform(button.dataset.transform);
      const repeat=()=>{
        if (!hold) return;
        quickTransform(button.dataset.transform);
        hold.timer=setTimeout(repeat,80);
      };
      hold.timer=setTimeout(repeat,350);
    });
    for (const name of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(name,stopHold);
    // Keyboard and assistive-technology activation have no pointer press.
    button.addEventListener("click",event=>{
      if (event.detail===0) { quickTransform(button.dataset.transform); onChange(); }
    });
  }
  dismiss.addEventListener("click", () => { finish(true); select(null); });
  return {
    clear() { finish(true); select(null); items = []; roots.clear(); canvas.classList.remove("can-move"); },
    setItems(next, nextSpec, nextHeightAt, extent) {
      items = next; spec = nextSpec; heightAt = nextHeightAt; limit = extent * .9;
      roots = new Map(items.map(item => [item.model, item]));
      items.forEach(item => { item.original ??= { x: item.x, z: item.z, scale: item.model.scale.clone(), rotation: item.model.rotation.y }; });
    },
    setEnabled(value) { if (!value) { finish(true); select(null); } enabled = value; },
    update() { if (selected) { outline.setFromObject(selected.model); positionPanel(); } },
    get dragging() { return !!drag; },
  };
}
