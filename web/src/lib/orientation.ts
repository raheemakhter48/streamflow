export const lockLandscape = async () => {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>;
  };

  try {
    await orientation.lock?.("landscape");
  } catch {
    // Orientation lock support varies by browser and requires fullscreen/PWA.
  }
};

export const unlockOrientation = () => {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Ignore browsers that do not expose orientation unlock.
  }
};
