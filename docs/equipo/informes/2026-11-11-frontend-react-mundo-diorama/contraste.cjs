const lum = (h) => { const m = /#(..)(..)(..)/.exec(h); const c = [1,2,3].map(i => parseInt(m[i],16)/255).map(s => s <= .03928 ? s/12.92 : ((s+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2] }
const cr = (a,b) => { const x=lum(a), y=lum(b); return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)) }
// mezcla color con alfa sobre fondo
const mix = (fg, a, bg) => { const f=/#(..)(..)(..)/.exec(fg), b=/#(..)(..)(..)/.exec(bg); return '#'+[1,2,3].map(i=>Math.round(parseInt(f[i],16)*a+parseInt(b[i],16)*(1-a)).toString(16).padStart(2,'0')).join('') }
const T = {
 light: { base:'#e9f0fa', surface:'#ffffff', surface2:'#f1f5fb', surface3:'#e2eaf5', line:'#d3deed', lineStrong:'#7384a1',
   fg:'#14213a', fgWarm:'#0c1730', fgMuted:'#45536f', fgSubtle:'#53627e',
   accent:'#2559e8', accentInk:'#1d4cd0', onAccent:'#ffffff',
   danger:'#b32119', warning:'#7d4e00', ok:'#0f6a49', info:'#1b5fa8', onDanger:'#ffffff' },
 dark: { base:'#0e1a30', surface:'#162540', surface2:'#1c2e4d', surface3:'#263c61', line:'#2b3f63', lineStrong:'#7189b3',
   fg:'#e9effc', fgWarm:'#f6f9ff', fgMuted:'#b3c0da', fgSubtle:'#9aa9c6',
   accent:'#3b69f0', accentInk:'#a4bdff', onAccent:'#ffffff',
   danger:'#ff8a80', warning:'#f4bb55', ok:'#62d0a2', info:'#84bbf5', onDanger:'#0e1a30' },
}
for (const [name,t] of Object.entries(T)) {
  console.log('==', name)
  const rows = []
  const add = (l, a, b, min) => { const c = cr(a,b); rows.push(`${c>=min?'ok  ':'FAIL'} ${c.toFixed(2).padStart(5)} (min ${min}) ${l}`) }
  for (const bg of ['base','surface','surface2','surface3']) {
    add(`fg/${bg}`, t.fg, t[bg], 4.5); add(`fgWarm/${bg}`, t.fgWarm, t[bg], 4.5); add(`fgMuted/${bg}`, t.fgMuted, t[bg], 4.5); add(`fgSubtle/${bg}`, t.fgSubtle, t[bg], 4.5)
    add(`accentInk/${bg}`, t.accentInk, t[bg], 4.5)
    for (const s of ['danger','warning','ok','info']) add(`${s}/${bg}`, t[s], t[bg], 4.5)
  }
  for (const bg of ['base','surface']) add(`lineStrong/${bg} (no-text 3:1)`, t.lineStrong, t[bg], 3)
  add('onAccent/accent', t.onAccent, t.accent, 4.5); add('onDanger/danger', t.onDanger, t.danger, 4.5)
  add('accent/surface (no-text 3:1)', t.accent, t.surface, 3); add('accent/base (3:1)', t.accent, t.base, 3)
  // tonos suaves: texto de estado sobre su fondo suave sobre surface
  const soft = { danger:[.10], warning:[.16], ok:[.11], info:[.10], accent:[.10] }
  for (const [s,[a]] of Object.entries(soft)) { const col = s==='accent'? t.accentInk : t[s]; for (const bg of ['surface','base']) { const sb = mix(s==='accent'?t.accent:t[s], a, t[bg]); add(`${s} text on soft-${s}/${bg}`, col, sb, 4.5) } }
  console.log(rows.join('\n'))
}
