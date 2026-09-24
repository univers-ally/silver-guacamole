export const el = id => document.getElementById(id);

export function delegate(root, selector, handler) {
  root.addEventListener("click", event => {
    const hit = event.target.closest(selector);
    if (hit && root.contains(hit)) handler(hit, event);
  });
}

export const escapeHtml = text =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const countText = (shown, total, noun) =>
  `${shown === total ? shown : `${shown} of ${total}`} ${noun}`;

export function setPressed(chip, on) {
  chip.classList.toggle("on", on);
  chip.setAttribute("aria-pressed", on);
}

export function setUpChipRow(container, picked, onChange) {
  delegate(container, ".chip", chip => {
    const key = chip.dataset.f;
    if (!picked.delete(key)) picked.add(key);
    setPressed(chip, picked.has(key));
    onChange();
  });
}

export function isTyping() {
  const node = document.activeElement;
  return !!node && (node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName));
}

export function h(tag, attributes, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
  node.append(
    ...children.flat().filter(child => child !== null && child !== undefined && child !== false),
  );
  return node;
}
