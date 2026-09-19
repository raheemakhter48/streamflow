// Keep fullscreen on our wrapper so provider controls and our exit button stay
// available together. A browser without this API can still expand in-page.
export const enterPlayerFullscreen = async (element: HTMLElement): Promise<boolean> => {
  if (!element.requestFullscreen) return false;
  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
};

export const ownsPlayerFullscreen = (element: HTMLElement, doc: Document = document) => {
  return !!doc.fullscreenElement && element.contains(doc.fullscreenElement);
};

export const exitPlayerFullscreen = async (element: HTMLElement, doc: Document = document) => {
  if (ownsPlayerFullscreen(element, doc)) await doc.exitFullscreen();
};
