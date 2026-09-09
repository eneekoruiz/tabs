/** Keep keyboard navigation inside a dialog and restore its trigger. */
export function trapModalFocus(root, { onClose, returnFocus, initialFocus } = {}) {
  const previous = document.activeElement;
  const focusable = () => [...root.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length && !element.closest('[hidden], [inert]'));
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); onClose?.();
    } else if (event.key === 'Tab') {
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  };
  root.tabIndex = -1;
  root.addEventListener('keydown', onKeyDown);
  (initialFocus || focusable()[0] || root)?.focus?.({ preventScroll: true });
  return (restore = true) => {
    root.removeEventListener('keydown', onKeyDown);
    const target = typeof returnFocus === 'function' ? returnFocus() : returnFocus || previous;
    if (restore && target?.isConnected) target?.focus?.({ preventScroll: true });
  };
}
