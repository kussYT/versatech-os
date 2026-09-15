import type { PointerEvent } from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setPointerSpot(event: PointerEvent<HTMLElement>) {
  if (prefersReducedMotion()) {
    return;
  }

  const node = event.currentTarget;
  const rect = node.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const angle = Math.atan2(y - 50, x - 50) * (180 / Math.PI) + 180;

  node.style.setProperty("--pointer-x", `${x}%`);
  node.style.setProperty("--pointer-y", `${y}%`);
  node.style.setProperty("--spot-x", `${x}%`);
  node.style.setProperty("--spot-y", `${y}%`);
  node.style.setProperty("--spot-angle", `${angle}deg`);
}

export function clearPointerSpot(event: PointerEvent<HTMLElement>) {
  const node = event.currentTarget;
  node.style.removeProperty("--pointer-x");
  node.style.removeProperty("--pointer-y");
  node.style.removeProperty("--spot-x");
  node.style.removeProperty("--spot-y");
  node.style.removeProperty("--spot-angle");
}
