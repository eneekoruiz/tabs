// Native disclosures keep secondary controls in the current screen.
export function foldControls(root, nodes, { id, label = 'Opciones avanzadas', owner, parent = root, before = null } = {}) {
  nodes = [...new Set(nodes)].filter(Boolean);
  if (!nodes.length) return null;
  const details = document.createElement('details'); details.id = id; details.className = 'app-disclosure';
  const summary = document.createElement('summary'); summary.textContent = label;
  const body = document.createElement('div'); body.className = 'app-disclosure-body';
  details.append(summary, body); nodes.forEach(node => body.append(node));
  parent.insertBefore(details, before);
  if (owner) {
    owner.disclosureState ||= new Map(); details.open = owner.disclosureState.get(id) || false;
    details.addEventListener('toggle', () => owner.disclosureState.set(id, details.open));
  }
  return details;
}
