// Tiny DOM helpers (no framework).

export type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  let value: unknown;
  let hasValue = false;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'value') { value = v; hasValue = true; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'dataset') Object.assign(el.dataset, v as object);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  // <select>.value must be set after its <option>s exist.
  if (hasValue) (el as unknown as { value: unknown }).value = value;
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (Array.isArray(c)) append(el, c);
    else if (c === null || c === undefined || c === false) continue;
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  el.replaceChildren();
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Numeric <input> that clamps to [min, max] and reports integer values. */
export function numberInput(
  value: number, min: number, max: number, onChange: (v: number) => void, extra: Record<string, unknown> = {},
): HTMLInputElement {
  const input = h('input', { type: 'number', min, max, step: 1, value: String(value), inputMode: 'numeric', ...extra });
  let last = value;
  input.addEventListener('change', () => {
    const v = clamp(Math.floor(Number(input.value) || 0), min, max);
    input.value = String(v);
    // Re-rendering removes the focused input, which can fire a second `change`; ignore repeats.
    if (v === last) return;
    last = v;
    onChange(v);
  });
  return input;
}

export function textInput(
  value: string, maxLength: number, onChange: (v: string) => void, extra: Record<string, unknown> = {},
): HTMLInputElement {
  const input = h('input', { type: 'text', maxLength, value, autocomplete: 'off', spellcheck: false, ...extra });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

export function selectInput(
  options: { value: number | string; label: string }[], value: number | string, onChange: (v: string) => void,
): HTMLSelectElement {
  const sel = h('select', { value: String(value), onchange: () => onChange(sel.value) },
    options.map((o) => h('option', { value: String(o.value) }, o.label)));
  return sel;
}

type Choice = { value: number | string; label: string };
const optionTemplates = new WeakMap<Choice[], DocumentFragment>();
const FILL_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'focus', 'keydown'] as const;

/**
 * A <select> for a long list that is repeated down a page (an item picker on every bag row). It starts with just
 * the one option that is selected and fills in the rest the moment someone touches it (pointer, focus or key), so
 * 70 rows cost 70 options instead of ~8,700. Pass the same `options` array each time so its markup is built once
 * and cloned.
 */
export function lazySelect(options: Choice[], value: number | string, onChange: (v: string) => void): HTMLSelectElement {
  const current = options.find((o) => String(o.value) === String(value));
  const sel = h('select', {}, h('option', { value: String(value) }, current?.label ?? String(value)));
  sel.value = String(value);
  const fill = () => {
    for (const ev of FILL_EVENTS) sel.removeEventListener(ev, fill);
    let tpl = optionTemplates.get(options);
    if (!tpl) {
      tpl = document.createDocumentFragment();
      tpl.append(...options.map((o) => h('option', { value: String(o.value) }, o.label)));
      optionTemplates.set(options, tpl);
    }
    const keep = sel.value;
    sel.replaceChildren(tpl.cloneNode(true));
    sel.value = keep;
  };
  for (const ev of FILL_EVENTS) sel.addEventListener(ev, fill);
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

export function field(label: string, control: Node, hint?: string): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

/** In-page replacement for confirm(), which hosted viewers suppress (it returns false immediately). */
export function askConfirm(message: string, okLabel = 'OK', cancelLabel = 'Cancel'): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'confirm-dialog' },
      h('p', {}, message),
      h('div', { class: 'button-row end' },
        h('button', { onclick: () => dlg.close('no') }, cancelLabel),
        h('button', { class: 'primary', onclick: () => dlg.close('yes') }, okLabel)));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** Short status message at the bottom of the screen. */
export function toast(message: string): void {
  document.getElementById('toast')?.remove();
  const el = h('div', { id: 'toast', class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 5000);
}
