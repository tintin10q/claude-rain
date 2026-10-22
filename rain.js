"use strict";

// Rendering strategy: each depth layer is drawn ONCE into a canvas that repeats
// vertically with period TILE_SIZE. The canvas is then moved with a transform
// animation (Web Animations API), which the browser runs on the compositor
// thread / GPU. Per frame there is no JavaScript and no redrawing; only a
// texture offset changes. Wind slant comes from rotating the whole stage.
 
(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "claudeRainEnabled";
  const FADE_MS = 600;
  const TILE_SIZE = 512;
  const WIND_ANGLE_DEG = -7; // negative = drops fall down and to the right
  const RESIZE_DEBOUNCE_MS = 150;
 
  // Far to near: slower, shorter, fainter in the back.
  const LAYERS = [
    { speed: 450, length: 10, alpha: 0.07, width: 0.6, dropsPerTile: 14 },
    { speed: 750, length: 17, alpha: 0.11, width: 0.9, dropsPerTile: 12 },
    { speed: 1050, length: 25, alpha: 0.16, width: 1.2, dropsPerTile: 10 },
  ];
 
  const root = document.createElement("div");
  root.id = "claude-rain";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "2147483647",
    opacity: "0",
    display: "none",
    transition: `opacity ${FADE_MS}ms ease`,
  });
 
  const stage = document.createElement("div");
  Object.assign(stage.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
  });
  root.appendChild(stage);
  document.documentElement.appendChild(root);
 
  let isEnabled = false;
  let animations = [];
  let resizeTimeoutId = null;
  let fadeTimeoutId = null;
  let isRenderedDark = null;
 
  function isDarkMode() {
    const hasDarkClass = document.documentElement.classList.contains("dark");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return hasDarkClass || prefersDark;
  }
 
  function drawTile(layer, rgb) {
    const tile = document.createElement("canvas");
    tile.width = TILE_SIZE;
    tile.height = TILE_SIZE;
    const tileContext = tile.getContext("2d");
    tileContext.strokeStyle = `rgba(${rgb}, ${layer.alpha})`;
    tileContext.lineWidth = layer.width;
    tileContext.lineCap = "round";
    tileContext.beginPath();
    for (let index = 0; index < layer.dropsPerTile; index++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      // Draw a wrapped copy so streaks crossing the bottom edge tile seamlessly.
      for (const offsetY of [0, -TILE_SIZE]) {
        tileContext.moveTo(x, y + offsetY);
        tileContext.lineTo(x, y + offsetY + layer.length);
      }
    }
    tileContext.stroke();
    return tile;
  }
 
  function buildLayers() {
    for (const animation of animations) animation.cancel();
    animations = [];
    stage.replaceChildren();
 
    // The stage is a square covering the viewport diagonal, so it still fills
    // the screen after rotation.
    const diagonal = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight));
    Object.assign(stage.style, {
      width: `${diagonal}px`,
      height: `${diagonal}px`,
      transform: `translate(-50%, -50%) rotate(${WIND_ANGLE_DEG}deg)`,
    });
 
    isRenderedDark = isDarkMode();
    const rgb = isRenderedDark ? "200, 215, 235" : "0, 0, 0";
    for (const layer of LAYERS) {
      // Rendered at CSS pixel resolution on purpose: faint 1px streaks look the
      // same at higher DPR, and this keeps GPU memory around 20 MB per layer.
      const canvas = document.createElement("canvas");
      canvas.width = diagonal;
      canvas.height = diagonal + TILE_SIZE;
      Object.assign(canvas.style, {
        position: "absolute",
        left: "0",
        top: `${-TILE_SIZE}px`,
        willChange: "transform",
      });
      const canvasContext = canvas.getContext("2d");
      canvasContext.fillStyle = canvasContext.createPattern(drawTile(layer, rgb), "repeat");
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      stage.appendChild(canvas);
 
      const animation = canvas.animate(
        [{ transform: "translateY(0)" }, { transform: `translateY(${TILE_SIZE}px)` }],
        { duration: (TILE_SIZE / layer.speed) * 1000, iterations: Infinity, easing: "linear" },
      );
      if (!isEnabled) animation.pause();
      animations.push(animation);
    }
  }
 
  function start() {
    clearTimeout(fadeTimeoutId);
    root.style.display = "";
    for (const animation of animations) animation.play();
    // Force a style flush so the opacity transition runs from 0.
    void root.offsetHeight;
    root.style.opacity = "1";
  }
 
  function stop() {
    root.style.opacity = "0";
    clearTimeout(fadeTimeoutId);
    fadeTimeoutId = setTimeout(() => {
      if (isEnabled) return;
      // display:none removes the layers from compositing entirely: zero cost.
      root.style.display = "none";
      for (const animation of animations) animation.pause();
    }, FADE_MS);
  }
 
  function applyEnabled(shouldEnable) {
    isEnabled = shouldEnable;
    if (isEnabled) start();
    else stop();
  }
 
  function onResize() {
    clearTimeout(resizeTimeoutId);
    resizeTimeoutId = setTimeout(buildLayers, RESIZE_DEBOUNCE_MS);
  }
 
  function onThemeMaybeChanged() {
    const hasThemeChanged = isDarkMode() !== isRenderedDark;
    if (hasThemeChanged) buildLayers();
  }
 
  function onKeyDown(event) {
    const isToggleShortcut = event.ctrlKey && event.altKey && !event.shiftKey && event.code === "KeyR";
    if (!isToggleShortcut) return;
    event.preventDefault();
    event.stopPropagation();
    const nextEnabled = !isEnabled;
    applyEnabled(nextEnabled);
    extensionApi.storage.local.set({ [STORAGE_KEY]: nextEnabled });
  }
 
  function onStorageChanged(changes, areaName) {
    const change = changes[STORAGE_KEY];
    if (areaName !== "local" || change === undefined) return;
    if (change.newValue !== isEnabled) applyEnabled(change.newValue);
  }
 
  buildLayers();
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown, true);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onThemeMaybeChanged);
  new MutationObserver(onThemeMaybeChanged).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  extensionApi.storage.onChanged.addListener(onStorageChanged);
 
  extensionApi.storage.local.get(STORAGE_KEY).then((stored) => {
    const storedEnabled = stored[STORAGE_KEY];
    applyEnabled(storedEnabled ?? true);
  });
})();

