/** Small DOM helper so pages stay declarative and share one element path. */

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendChildren(node, child);
    else node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  let value;
  let checked;
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (key === "class") node.className = val;
    else if (key === "html") node.innerHTML = val;
    else if (key === "value") value = val;
    else if (key === "checked") checked = Boolean(val);
    else if (key.startsWith("on") && typeof val === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === "dataset" && val && typeof val === "object") {
      Object.assign(node.dataset, val);
    } else node.setAttribute(key, val === true ? "" : String(val));
  }
  appendChildren(node, children);
  if (value != null && "value" in node) node.value = String(value);
  if (checked != null) node.checked = checked;
  return node;
}

export function replace(node, ...children) {
  node.replaceChildren();
  appendChildren(node, children);
}
