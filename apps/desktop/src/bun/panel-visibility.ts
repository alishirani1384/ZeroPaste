let hideImpl: () => void = () => {};
let showImpl: () => void = () => {};

export function registerPanelVisibility(api: { hide: () => void; show: () => void }) {
  hideImpl = api.hide;
  showImpl = api.show;
}

export function hidePanel() {
  hideImpl();
}

export function showPanel() {
  showImpl();
}
