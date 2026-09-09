export function icon(name, size = 20) {
  const definition = globalThis.lucide?.icons?.[name];
  if (!definition) return '';
  return globalThis.lucide.createElement(definition, {
    width: size, height: size, 'aria-hidden': 'true', focusable: 'false',
    'stroke-width': 1.8,
  }).outerHTML;
}
