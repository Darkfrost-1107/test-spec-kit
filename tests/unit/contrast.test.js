import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/web/views/layout.js';

// Contraste WCAG AA (≥ 4.5:1) de los pares texto/fondo declarados en el CSS (Principio III, SC-007).
const full = (hex) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex);
const vars = Object.fromEntries([...CSS.matchAll(/--([\w-]+):(#[0-9a-f]{3,6})\b/gi)].map(([, k, v]) => [k, full(v)]));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const PAIRS = [
  ['ink', 'bg'], ['ink', 'card'], ['muted', 'bg'], ['muted', 'card'], ['brand', 'card'],
  ['ok', 'okbg'], ['bad', 'badbg'], ['bad', 'card'], ['ok', 'card'],
];

for (const [fg, bg] of PAIRS) {
  test(`contraste ${fg} sobre ${bg} cumple WCAG AA`, () => {
    assert.ok(vars[fg] && vars[bg], 'variables CSS definidas');
    assert.ok(ratio(vars[fg], vars[bg]) >= 4.5, `${vars[fg]} / ${vars[bg]} = ${ratio(vars[fg], vars[bg]).toFixed(2)}`);
  });
}

test('texto blanco sobre el color de marca y el de peligro cumple WCAG AA', () => {
  assert.ok(ratio('#ffffff', vars.brand) >= 4.5);
  assert.ok(ratio('#ffffff', vars.bad) >= 4.5);
});
