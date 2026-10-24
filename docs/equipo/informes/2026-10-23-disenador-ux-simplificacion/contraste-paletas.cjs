// Contraste WCAG 2.x de las 3 direcciones (claro y oscuro). Umbrales: texto 4,5:1 · bordes de control y gráficos 3:1.
const L = (hex) => {
  const n = hex.replace('#', '')
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const cr = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const P = {
  'A claro': { bg: '#F7F7F5', surface: '#FFFFFF', s2: '#F1F1EE', line: '#E3E2DD', lineStrong: '#8A8984', fg: '#1B1D1F', muted: '#575C61', subtle: '#64696F', accent: '#24613A', onAccent: '#FFFFFF', danger: '#B42318', warning: '#8A5300', ok: '#1E6B43', info: '#2556A3', bar: '#8F8E88' },
  'A oscuro': { bg: '#161718', surface: '#1E1F21', s2: '#26282A', line: '#2E3033', lineStrong: '#71767A', fg: '#EDEDEB', muted: '#A6A9AC', subtle: '#8E9296', accent: '#7CC495', onAccent: '#111312', danger: '#F07A6E', warning: '#E0A854', ok: '#6CC79B', info: '#86B6EA', bar: '#6B7074' },
  'B oscuro': { bg: '#151617', surface: '#1C1E1F', s2: '#242628', line: '#2D3032', lineStrong: '#6E7377', fg: '#ECECEA', muted: '#A3A6A8', subtle: '#8B8F92', accent: '#BFE07A', onAccent: '#151617', danger: '#F2766B', warning: '#E2AA4F', ok: '#6CC79B', info: '#83B4E8', bar: '#666B6F' },
  'B claro': { bg: '#F6F6F5', surface: '#FFFFFF', s2: '#EFEFED', line: '#E2E2DF', lineStrong: '#878783', fg: '#18191A', muted: '#55585B', subtle: '#62666A', accent: '#3D6B00', onAccent: '#FFFFFF', danger: '#B42318', warning: '#8A5300', ok: '#1E6B43', info: '#2556A3', bar: '#8D8E8A', lime: '#BFE07A' },
  'C claro (papel)': { bg: '#F3F0E8', surface: '#FBF9F4', s2: '#ECE7DC', line: '#DAD3C5', lineStrong: '#857E70', fg: '#24211C', muted: '#5B554B', subtle: '#6A6458', accent: '#1F4D3A', onAccent: '#FBF9F4', danger: '#A3271B', warning: '#855000', ok: '#2B6A44', info: '#2B4F86', bar: '#8F8676' },
  'C oscuro (tinta)': { bg: '#1A1814', surface: '#221F1A', s2: '#2A2620', line: '#3A352D', lineStrong: '#7E7667', fg: '#EDE8DD', muted: '#B3AB9C', subtle: '#9C9485', accent: '#8DBFA3', onAccent: '#1A1814', danger: '#E8806F', warning: '#D9A55A', ok: '#8CC79F', info: '#8FB0E0', bar: '#756D5F' },
}
let fails = 0
for (const [name, p] of Object.entries(P)) {
  const rows = []
  const chk = (label, a, b, min) => {
    const v = cr(a, b)
    const ok = v >= min
    if (!ok) fails++
    rows.push(`${label} ${v.toFixed(2)}${ok ? '' : ' ✗(<' + min + ')'}`)
    return v
  }
  for (const k of ['fg', 'muted', 'subtle']) {
    chk(`${k}/bg`, p[k], p.bg, 4.5)
    chk(`${k}/surface`, p[k], p.surface, 4.5)
    chk(`${k}/s2`, p[k], p.s2, 4.5)
  }
  chk('accent-texto/bg', p.accent, p.bg, 4.5)
  chk('accent-texto/surface', p.accent, p.surface, 4.5)
  chk('onAccent/accent', p.onAccent, p.accent, 4.5)
  if (p.lime) chk('fg/lima(botón)', p.fg, p.lime, 4.5)
  chk('lineStrong/bg', p.lineStrong, p.bg, 3)
  chk('lineStrong/surface', p.lineStrong, p.surface, 3)
  chk('lineStrong/s2', p.lineStrong, p.s2, 3)
  for (const k of ['danger', 'warning', 'ok', 'info']) chk(`${k}/surface`, p[k], p.surface, 4.5)
  chk('foco(accent)/bg', p.accent, p.bg, 3)
  chk('barra/surface', p.bar, p.surface, 3)
  console.log(`\n## ${name}\n` + rows.join(' · '))
}
console.log('\nFALLOS:', fails)
