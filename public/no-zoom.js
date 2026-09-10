// iOS Safari ignores `user-scalable=no` / `maximum-scale` in the viewport
// meta tag (Apple deliberately keeps pinch-zoom available at the OS level),
// so blocking it fully requires intercepting the gesture events directly.

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault());
});

document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);

let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);
