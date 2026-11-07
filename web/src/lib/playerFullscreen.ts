// Cross-browser Fullscreen helper including iOS WebKit / Safari
export const enterPlayerFullscreen = async (element: HTMLElement): Promise<boolean> => {
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return true;
    }
    const el = element as any;
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
    if (el.webkitEnterFullscreen) {
      await el.webkitEnterFullscreen();
      return true;
    }
    const video = element.querySelector("video") as any;
    if (video && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const ownsPlayerFullscreen = (element: HTMLElement, doc: Document = document) => {
  const d = doc as any;
  const current = doc.fullscreenElement || d.webkitFullscreenElement || d.webkitCurrentFullScreenElement;
  return !!current && (current === element || element.contains(current));
};

export const exitPlayerFullscreen = async (element: HTMLElement, doc: Document = document) => {
  try {
    const d = doc as any;
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {}
};
