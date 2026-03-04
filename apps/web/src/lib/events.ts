export const WORKSPACES_CHANGED = 'engineone-workspaces-changed';

export function emitWorkspacesChanged() {
  window.dispatchEvent(new CustomEvent(WORKSPACES_CHANGED));
}
