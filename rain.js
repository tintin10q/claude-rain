"use strict";

(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "claudeRainEnabled";
  const FADE_MS = 600;
  const DROPS_PER_MEGAPIXEL = 140;
  const WIND = 0.12; // horizontal drift per unit of vertical speed

  const canvas = document.createElement("canvas");
  canvas.id = "claude-rain-canvas";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "2147483647",
    opacity: "0",
    transition: `opacity ${FADE_MS}ms ease`,
  });
  document.documentElement.appendChild(canvas);
  const context = canvas.getContext("2d");

  let drops = [];
  let isEnabled = false;
  let animationFrameId = null;
  let lastTimestamp = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;

  function createDrop(isInitialSpawn) {
    const depth = Math.random(); // 0 = far, 1 = near
    return {
      x: Math.random() * (viewportWidth + viewportHeight * WIND) - viewportHeight * WIND,
      y: isInitialSpawn ? Math.random() * viewportHeight : -Math.random() * 100,
      length: 10 + depth * 18,
      speed: 450 + depth * 650, // px per second
      alpha: 0.05 + depth * 0.12,
      width: 0.6 + depth * 0.6,
    };
  }

  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const dropCount = Math.round((viewportWidth * viewportHeight / 1e6) * DROPS_PER_MEGAPIXEL);
    drops = Array.from({ length: dropCount }, () => createDrop(true));
  }

  function rainColor() {
    const isDarkMode = document.documentElement.classList.contains("dark")
      || window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDarkMode ? "200, 215, 235" : "90, 110, 140";
  }

  function frame(timestamp) {
    const elapsedSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;

    const color = rainColor();
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.lineCap = "round";

    for (const drop of drops) {
      drop.y += drop.speed * elapsedSeconds;
      drop.x += drop.speed * WIND * elapsedSeconds;

      const isOffScreen = drop.y - drop.length > viewportHeight;
      if (isOffScreen) Object.assign(drop, createDrop(false));

      context.strokeStyle = `rgba(${color}, ${drop.alpha})`;
      context.lineWidth = drop.width;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.length * WIND, drop.y - drop.length);
      context.stroke();
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  function start() {
    if (animationFrameId !== null) return;
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(frame);
    canvas.style.opacity = "1";
  }

  function stop() {
    canvas.style.opacity = "0";
    setTimeout(() => {
      if (isEnabled || animationFrameId === null) return;
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      context.clearRect(0, 0, viewportWidth, viewportHeight);
    }, FADE_MS);
  }

  function applyEnabled(shouldEnable) {
    isEnabled = shouldEnable;
    if (isEnabled) start();
    else stop();
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

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown, true);
  extensionApi.storage.onChanged.addListener(onStorageChanged);

  extensionApi.storage.local.get(STORAGE_KEY).then((stored) => {
    const storedEnabled = stored[STORAGE_KEY];
    applyEnabled(storedEnabled ?? true);
  });
})();
