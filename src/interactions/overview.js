/*
  Pinch in (zoom out) from a card or iframe → open field of source logos,
  placed on a political map. The bar at the bottom switches the map style
  (default: smartmap). Pinch out (spread) returns to the carousel.
*/
import positions from '../data/source-positions.json'
import { createSegmented } from './segmented.js'

// Map styles, in the order of the buttons. Plots place each source by two
// values from data/source-positions.json (-1 = left / top, 1 = right / bottom).
const MODES = ['reliability', 'smartmap', 'types'] // smartmap in the middle
const MODE_LABELS = {
  smartmap: 'Smartmap',
  reliability: 'Reliability',
  types: 'Types',
}
const PLOTS = {
  // smartvote smartmap: left–right × liberal–conservative, drawn as a disc
  // with rings (centre = moderate, edge = extreme)
  smartmap: {
    shape: 'circle',
    x: (p) => p.econ,
    y: (p) => p.social,
    labels: { left: 'Left', right: 'Right', top: 'Liberal', bottom: 'Conservative' },
  },
  // Ad Fontes style: bias along the baseline, reliability as height
  reliability: {
    shape: 'scale',
    x: (p) => p.econ,
    y: (p) => 1 - 2 * p.reliability,
    labels: { left: 'Left', centre: 'Centre', right: 'Right', top: 'Reliable', bottom: 'Unreliable' },
  },
}
const DEFAULT_MODE = 'smartmap'
// Types: where each hub sits in the field (0..1)
const CLUSTER_ANCHORS = {
  Socialist: { x: 0.22, y: 0.16 },
  Ecologist: { x: 0.78, y: 0.16 },
  Liberal: { x: 0.52, y: 0.47 },
  'Neo-liberal': { x: 0.24, y: 0.84 },
  Conservative: { x: 0.80, y: 0.84 },
}

const CHIP = 40
const PINCH_RANGE = 0.42
// Same commitment as settling into the map: a modest zoom-in opens the card.
const ZOOM_OPEN = 0.42

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hash01(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function touchPoint(touches, i) {
  return { x: touches[i].clientX, y: touches[i].clientY }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// The map's area: set by createOverview (between the title / X and the
// button bar). Fallback numbers only for when nothing is measured yet.
let measureField = null

function fieldBox(layer) {
  if (measureField) return measureField(layer)
  const w = layer.clientWidth
  const h = layer.clientHeight
  const side = 18
  return { x: side, y: 240, w: w - side * 2, h: h - 240 - 97 }
}


// Rough box of an axis label (12px text), used to keep logos off it
function labelBox(text, x, y, align) {
  const w = text.length * 6.6 + 10
  const h = 18
  const left = align === 'start' ? x : align === 'end' ? x - w : x - w / 2
  return { x: left, y: y - h / 2, w, h }
}

// Push logos apart until none overlap (and none sit on a label),
// pulling each one gently back towards its true position.
function separate(nodes, obstacles, area, circle = null) {
  const min = CHIP + 6
  const half = CHIP / 2
  for (let step = 0; step < 320; step++) {
    const pull = step < 260 ? 0.04 : 0
    for (const n of nodes) {
      n.x += (n.tx - n.x) * pull
      n.y += (n.ty - n.y) * pull
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= min) continue
        if (d < 0.01) {
          const angle = hash01(a.seed + b.seed) * Math.PI * 2
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          d = 1
        }
        const push = (min - d) / 2
        a.x -= (dx / d) * push
        a.y -= (dy / d) * push
        b.x += (dx / d) * push
        b.y += (dy / d) * push
      }
    }
    for (const n of nodes) {
      for (const o of obstacles) {
        const l = o.x - half - 4
        const r = o.x + o.w + half + 4
        const t = o.y - half - 4
        const btm = o.y + o.h + half + 4
        if (n.x <= l || n.x >= r || n.y <= t || n.y >= btm) continue
        const out = [
          [n.x - l, -1, 0],
          [r - n.x, 1, 0],
          [n.y - t, 0, -1],
          [btm - n.y, 0, 1],
        ].sort((p, q) => p[0] - q[0])[0]
        n.x += out[1] * out[0]
        n.y += out[2] * out[0]
      }
      n.x = clamp(n.x, area.x + half, area.x + area.w - half)
      n.y = clamp(n.y, area.y + half, area.y + area.h - half)
      if (circle) {
        // keep each logo inside the oval
        const dx = n.x - circle.cx
        const dy = n.y - circle.cy
        const d = Math.hypot(dx / (circle.rx - half), dy / (circle.ry - half))
        if (d > 1) {
          n.x = circle.cx + dx / d
          n.y = circle.cy + dy / d
        }
      }
    }
  }
}

// Square (-1..1, -1..1) → disc, so the corners land on the rim
function toDisc(x, y) {
  return [x * Math.sqrt(1 - (y * y) / 2), y * Math.sqrt(1 - (x * x) / 2)]
}

function layoutPlot(from, layer, mode) {
  const plot = PLOTS[mode]
  // Smartmap and Reliability use 75% of the map area's height, centred
  const full = fieldBox(layer)
  const PLOT_HEIGHT = 0.85
  const field = { ...full, y: full.y + (full.h * (1 - PLOT_HEIGHT)) / 2, h: full.h * PLOT_HEIGHT }
  const midX = field.x + field.w / 2
  const midY = field.y + field.h / 2
  const { labels } = plot
  let axes
  let area = field
  let circle = null
  let place

  if (plot.shape === 'circle') {
    // Oval: fills the whole map area (a little room for the labels on the rim)
    const rx = field.w / 2 - 16
    const ry = field.h / 2 - 10
    circle = { cx: midX, cy: midY, rx, ry }
    axes = {
      shape: 'circle',
      circle,
      labels: [
        { text: labels.top, x: midX, y: midY - ry, side: 'ring' },
        { text: labels.bottom, x: midX, y: midY + ry, side: 'ring' },
        { text: labels.left, x: midX - rx, y: midY, side: 'ring' },
        { text: labels.right, x: midX + rx, y: midY, side: 'ring' },
      ],
    }
    const spanX = rx - CHIP / 2
    const spanY = ry - CHIP / 2
    place = (vx, vy) => {
      const [dx, dy] = toDisc(vx, vy)
      return [midX + dx * spanX, midY + dy * spanY]
    }
  } else {
    // Scale: levels from "Reliable" (top) to "Unreliable", baseline at the bottom
    const top = field.y + 20
    const base = field.y + field.h - 22
    area = { x: field.x, y: top, w: field.w, h: base - top }
    const levels = [0, 0.25, 0.5, 0.75, 1].map((f) => top + f * (base - top))
    axes = {
      shape: 'scale',
      field,
      levels,
      labels: [
        { text: labels.top, x: field.x, y: field.y + 8, side: 'start' },
        { text: labels.bottom, x: field.x + field.w, y: field.y + 8, side: 'end' },
        { text: labels.left, x: field.x, y: base + 12, side: 'start' },
        { text: labels.centre, x: midX, y: base + 12, side: 'middle' },
        { text: labels.right, x: field.x + field.w, y: base + 12, side: 'end' },
      ],
    }
    const spanX = field.w / 2 - CHIP / 2
    const spanY = area.h / 2 - CHIP / 2
    const areaMid = area.y + area.h / 2
    place = (vx, vy) => [midX + vx * spanX, areaMid + vy * spanY]
  }

  const align = (side) => (side === 'start' ? 'start' : side === 'end' ? 'end' : 'middle')
  const obstacles = axes.labels.map((l) => labelBox(l.text, l.x, l.y, align(l.side)))

  const nodes = []
  for (const [id, item] of from) {
    const p = positions[item.source]
    const vx = p ? clamp(plot.x(p), -1, 1) : 0
    const vy = p ? clamp(plot.y(p), -1, 1) : 0
    const [tx, ty] = place(vx, vy)
    nodes.push({ id, type: item.type, tx, ty, x: tx, y: ty, seed: Number(id) || 0 })
  }
  // Smartmap: the oval is drawn at 75%, but crowded logos may push out
  // past its rim into the rest of the map area so none overlap
  if (circle) separate(nodes, obstacles, full)
  else separate(nodes, obstacles, area)

  const targets = new Map()
  for (const n of nodes) {
    targets.set(String(n.id), {
      x: n.x - CHIP / 2,
      y: n.y - CHIP / 2,
      w: CHIP,
      h: CHIP,
      type: n.type,
    })
  }
  return { targets, clusters: [], axes }
}

// Types: one hub per type, its newspapers in rings around it,
// a line from the hub to each logo
function layoutTypes(from, layer) {
  const field = fieldBox(layer)
  const groups = new Map()
  for (const [id, item] of from) {
    const type = item.type || 'Other'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push({ id, ...item })
  }

  const hubs = []
  const nodes = []
  for (const [type, members] of groups) {
    const anchor = CLUSTER_ANCHORS[type] ?? { x: 0.5, y: 0.5 }
    const hx = field.x + anchor.x * field.w
    const hy = field.y + anchor.y * field.h
    hubs.push({ type, x: hx, y: hy })

    // Fill rings outwards: each ring holds as many logos as fit around it
    let ring = 0
    let placed = 0
    while (placed < members.length) {
      const r = 52 + ring * 46
      const fit = Math.max(1, Math.floor((2 * Math.PI * r) / 48))
      const count = Math.min(fit, members.length - placed)
      const turn = hash01(hy + ring) * Math.PI * 2
      for (let k = 0; k < count; k++) {
        const m = members[placed + k]
        const angle = turn + (k / count) * Math.PI * 2
        const tx = hx + Math.cos(angle) * r
        const ty = hy + Math.sin(angle) * r
        nodes.push({ id: m.id, type, tx, ty, x: tx, y: ty, seed: Number(m.id) || 0 })
      }
      placed += count
      ring++
    }
  }

  const obstacles = hubs.map((h) => labelBox(h.type, h.x, h.y, 'middle'))
  separate(nodes, obstacles, field)

  const targets = new Map()
  for (const n of nodes) {
    targets.set(String(n.id), { x: n.x - CHIP / 2, y: n.y - CHIP / 2, w: CHIP, h: CHIP, type: n.type })
  }
  const spokes = nodes.map((n) => {
    const hub = hubs.find((h) => h.type === n.type)
    return { x1: hub.x, y1: hub.y, x2: n.x, y2: n.y }
  })
  return { targets, clusters: [], axes: { shape: 'network', hubs, spokes } }
}

function layoutFor(mode, from, layer) {
  return mode === 'types' ? layoutTypes(from, layer) : layoutPlot(from, layer, mode)
}

export function createOverview(root, state, cards, { onViewChange } = {}) {
  // .map is in index.html; created here only if it is missing
  let map = root.querySelector('.map')
  if (!map) {
    map = document.createElement('section')
    map.className = 'map'
    map.setAttribute('aria-label', 'Sources by type')
    map.setAttribute('aria-hidden', 'true')
    root.append(map)
  }

  // Bar at the bottom: one button per map style, same as Bias Comparison
  let bar = root.querySelector('.map-bar')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'map-bar segmented'
    root.append(bar)
  }
  bar.setAttribute('aria-hidden', 'true')
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', 'Map style')
  bar.innerHTML =
    '<span class="segmented__thumb" aria-hidden="true"></span>' +
    MODES.map(
      (m) =>
        `<button class="segmented__button map-bar__button" type="button" data-value="${m}" aria-pressed="${m === DEFAULT_MODE}"><span class="segmented__label">${MODE_LABELS[m]}</span></button>`,
    ).join('')
  let mode = DEFAULT_MODE
  let modeRaf = 0
  const mapSwitch = createSegmented(bar, { onChange: (m) => setMode(m) })

  // Same top as the opened iframe: meta hidden, title scaled to 0.6, X shown
  // (rules for .mapopen next to .iframeopen in the CSS). No slider bar.
  const mapOpenTargets = root.querySelectorAll(
    '.meta, .hint, .carousel-counter, .carousel-label, .article__title, .iframe-close',
  )
  const titleText = root.querySelector('.article__title-text')
  const closeButton = root.querySelector('.iframe-close')
  const TITLE_SCALE = 0.6 // .article__title.iframeopen .article__title-text
  const GAP = 16 // space between the map and the title / buttons

  // Map area = all the space between the title (as it ends up, scaled)
  // or the X, whichever is lower, and the button bar. Same width as the page.
  measureField = (layer) => {
    const layerRect = layer.getBoundingClientRect()
    const zoom = layerRect.width / layer.clientWidth || 1
    const toLayer = (y) => (y - layerRect.top) / zoom
    let top = 0
    if (titleText) {
      const r = titleText.getBoundingClientRect()
      const now = new DOMMatrix(getComputedStyle(titleText).transform).a || 1
      top = Math.max(top, toLayer(r.top + (r.height / now) * TITLE_SCALE))
    }
    if (closeButton) top = Math.max(top, toLayer(closeButton.getBoundingClientRect().bottom))
    const barTop = toLayer(bar.getBoundingClientRect().top)
    const side = 18
    const y = top + GAP
    return {
      x: side,
      y,
      w: layer.clientWidth - side * 2,
      h: Math.max(120, barTop - GAP - y),
    }
  }

  const headline = root.querySelector('.headline')
  const slider = root.querySelector('.slider-container')

  let progress = state.view === 'overview' ? 1 : 0
  let session = null
  let pinch = null
  let raf = 0
  let wheelTimer = 0
  let inbound = false
  let zoomIn = 0
  let zoomOut = 0 // trackpad: how far a zoom-out on an open card has gone
  let closedByZoom = false // rest of that gesture must not open the map

  function renderMap(layout) {
    map.dataset.mode = mode
    const axes = layout.axes
    const label = (l) =>
      `<div class="map-axis-label map-axis-label--${l.side}" style="left:${l.x}px;top:${l.y}px">${l.text}</div>`
    if (axes?.shape === 'circle') {
      const { cx, cy, rx, ry } = axes.circle
      const ring = (f) =>
        `<div class="map-ring" style="left:${cx}px;top:${cy}px;width:${2 * rx * f}px;height:${2 * ry * f}px"></div>`
      map.innerHTML = `
        <div class="map-axes">
          ${[1, 2 / 3, 1 / 3].map(ring).join('')}
          <div class="map-axis map-axis--x" style="left:${cx - rx}px;top:${cy}px;width:${2 * rx}px"></div>
          <div class="map-axis map-axis--y" style="left:${cx}px;top:${cy - ry}px;height:${2 * ry}px"></div>
          ${axes.labels.map(label).join('')}
        </div>`
      return
    }
    if (axes?.shape === 'scale') {
      const { field, levels } = axes
      map.innerHTML = `
        <div class="map-axes">
          ${levels
            .map(
              (y, i) =>
                `<div class="map-level${i === levels.length - 1 ? ' map-level--base' : ''}" style="left:${field.x}px;top:${y}px;width:${field.w}px"></div>`,
            )
            .join('')}
          ${axes.labels.map(label).join('')}
        </div>`
      return
    }
    if (axes?.shape === 'network') {
      const w = map.clientWidth
      const h = map.clientHeight
      map.innerHTML = `
        <div class="map-axes">
          <svg class="map-spokes" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
            ${axes.spokes
              .map((l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`)
              .join('')}
          </svg>
          ${axes.hubs
            .map((hub) => label({ text: hub.type, x: hub.x, y: hub.y, side: 'hub' }))
            .join('')}
        </div>`
      return
    }
    map.innerHTML = ''
  }

  function applyChrome(t) {
    root.style.setProperty('--overview-progress', String(t))
    root.classList.toggle('is-overviewing', t > 0 && t < 1)
    root.classList.toggle('is-overview', t >= 0.999)
    map.setAttribute('aria-hidden', t > 0.2 ? 'false' : 'true')
    bar.setAttribute('aria-hidden', t > 0.2 ? 'false' : 'true')
    bar.style.pointerEvents = t >= 0.999 ? 'auto' : 'none'
    mapOpenTargets.forEach((el) => el.classList.toggle('mapopen', t > 0))

    if (headline) {
      headline.style.opacity = t ? String(1 - t) : ''
      headline.style.pointerEvents = t > 0.15 ? 'none' : ''
    }
    if (slider) {
      slider.style.opacity = t ? String(1 - t) : ''
      slider.style.pointerEvents = t > 0.15 ? 'none' : ''
    }
  }

  function ensureSession() {
    if (session) return session
    const wasOpen = cards.isOpen()
    const from = cards.beginFlight()
    const layout = layoutFor(mode, from, cards.getLayer())
    renderMap(layout)
    session = { from, to: layout.targets, wasOpen }
    return session
  }

  function setProgress(t) {
    const next = clamp(t, 0, 1)
    if (next < progress) inbound = true
    if (next > progress) inbound = false
    const entering = progress === 0 && next > 0
    progress = next
    const current = ensureSession()
    cards.applyFlight(current.from, current.to, progress, inbound)
    applyChrome(progress)
    if (entering) {
      root.dispatchEvent(new CustomEvent('parc:overview-enter'))
    }
    if (progress === 0) inbound = false
  }

  function finish(target) {
    setProgress(target)
    if (target === 0) {
      // Once the map was fully open, the card is already closed (below), so
      // zooming back in lands on the card overview. A pinch let go halfway
      // returns to where it started.
      if (session?.wasOpen) cards.setOpen(true)
      cards.endFlight()
      session = null
      applyChrome(0)
      map.innerHTML = ''
      onViewChange?.('slider')
      return
    }

    if (session?.wasOpen) {
      cards.setOpen(false)
      session.wasOpen = false
      cards.retargetToHomes(cards.measureHomes(), { closed: true })
    }
    onViewChange?.('overview')
  }

  function animateTo(target) {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(modeRaf)
    const start = progress
    if (Math.abs(start - target) < 0.002) {
      finish(target)
      return
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 1 : 480
    const t0 = performance.now()
    function tick(now) {
      const u = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - u) ** 3
      setProgress(start + (target - start) * eased)
      if (u < 1) raf = requestAnimationFrame(tick)
      else finish(target)
    }
    raf = requestAnimationFrame(tick)
  }

  function settle() {
    pinch = null
    const target = progress >= 0.42 ? 1 : 0
    animateTo(target)
  }

  // The slider bar handles its own gestures
  const onSlider = (event) => event.target.closest?.('.slider-container')

  // The card under the gesture, or the centred one when the pinch lands between cards.
  function openCardAt(x, y) {
    const hit = document.elementFromPoint(x, y)?.closest?.('.card')
    const card =
      hit && !hit.classList.contains('is-placeholder')
        ? hit
        : root.querySelector('.cards-track .card.is-center:not(.is-placeholder)')
    if (!card) return
    zoomIn = 0
    cards.open(card.dataset.id)
  }

  function onTouchStart(event) {
    if (event.touches.length < 2 || onSlider(event)) return
    event.preventDefault()
    cancelAnimationFrame(raf)
    cancelAnimationFrame(modeRaf)
    clearTimeout(wheelTimer)
    pinch = {
      startDist: distance(touchPoint(event.touches, 0), touchPoint(event.touches, 1)),
      startProgress: progress,
    }
  }

  function onTouchMove(event) {
    if (progress > 0 && event.touches.length < 2) {
      event.preventDefault()
      return
    }
    if (!pinch || event.touches.length < 2) return
    event.preventDefault()
    const dist = distance(touchPoint(event.touches, 0), touchPoint(event.touches, 1))
    const scale = dist / Math.max(pinch.startDist, 1)
    // Positive when the fingers come together (towards the map).
    const delta = (1 - scale) / PINCH_RANGE
    const a = touchPoint(event.touches, 0)
    const b = touchPoint(event.touches, 1)

    // Pinching in on an open card (iframe) closes it: back to the gallery,
    // same card centred. Only a pinch on the gallery opens the map.
    if (delta > 0 && progress === 0 && !session && cards.isOpen()) {
      if (delta >= ZOOM_OPEN) {
        pinch = null
        cards.close()
      }
      return
    }

    // Spreading on the gallery opens the card. Don't start the map flight for that.
    if (delta < 0 && progress === 0 && !session) {
      if (!cards.isOpen() && -delta >= ZOOM_OPEN) {
        pinch = null
        openCardAt((a.x + b.x) / 2, (a.y + b.y) / 2)
      }
      return
    }

    ensureSession()
    setProgress(pinch.startProgress + delta)
  }

  function onTouchEnd(event) {
    if (!pinch) return
    if (event.touches.length >= 2) {
      pinch.startDist = distance(
        touchPoint(event.touches, 0),
        touchPoint(event.touches, 1),
      )
      pinch.startProgress = progress
      return
    }
    settle()
  }

  function onWheel(event) {
    if (progress > 0 && !event.ctrlKey) {
      event.preventDefault()
      return
    }
    if (!event.ctrlKey || onSlider(event)) return
    event.preventDefault()
    cancelAnimationFrame(raf)
    const delta = event.deltaY * 0.0035
    // Trackpad pinch-out (deltaY < 0) on the gallery opens the card.
    // Further zoom-in, including the rest of the gesture that opened it, stays here.
    if (delta < 0 && progress === 0 && !session) {
      if (!cards.isOpen()) {
        zoomIn += -delta
        clearTimeout(wheelTimer)
        wheelTimer = setTimeout(() => {
          zoomIn = 0
        }, 140)
        if (zoomIn >= ZOOM_OPEN) openCardAt(event.clientX, event.clientY)
      }
      return
    }
    // Trackpad pinch-in (deltaY > 0) on an open card closes it. The rest of
    // that gesture is ignored, so it doesn't run on into the map.
    if (delta > 0 && progress === 0 && !session && (cards.isOpen() || closedByZoom)) {
      zoomOut += delta
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        zoomOut = 0
        closedByZoom = false
      }, 140)
      if (cards.isOpen() && zoomOut >= ZOOM_OPEN) {
        closedByZoom = true
        cards.close()
      }
      return
    }
    zoomIn = 0
    ensureSession()
    setProgress(progress + delta)
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(settle, 140)
  }

  function killGesture(event) {
    event.preventDefault()
  }

  const touchOpts = { passive: false, capture: true }
  root.addEventListener('touchstart', onTouchStart, touchOpts)
  root.addEventListener('touchmove', onTouchMove, touchOpts)
  root.addEventListener('touchend', onTouchEnd, touchOpts)
  root.addEventListener('touchcancel', onTouchEnd, touchOpts)
  root.addEventListener('wheel', onWheel, { passive: false, capture: true })
  root.addEventListener('gesturestart', killGesture)
  root.addEventListener('gesturechange', killGesture)
  root.addEventListener('gestureend', killGesture)

  cards.getLayer().addEventListener('click', (event) => {
    if (progress < 0.98) return
    const card = event.target.closest('.card')
    if (!card) return
    cards.centerById(card.dataset.id)
    cards.retargetToHomes(cards.measureHomes())
    animateTo(0)
  })

  window.addEventListener('resize', () => {
    if (!session || progress === 0) return
    const layout = layoutFor(mode, session.from, cards.getLayer())
    session.to = layout.targets
    renderMap(layout)
    cards.applyFlight(session.from, session.to, progress, inbound)
  })

  // Switch the map style: logos glide from their old spot to the new one
  function setMode(next) {
    if (next === mode) return
    mode = next
    if (!session) return

    const before = session.to
    const layout = layoutFor(mode, session.from, cards.getLayer())
    session.to = layout.targets
    renderMap(layout)
    if (progress < 0.999) {
      cards.applyFlight(session.from, session.to, progress, inbound)
      return
    }

    cancelAnimationFrame(modeRaf)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 1 : 560
    const t0 = performance.now()
    function tick(now) {
      const u = Math.min(1, (now - t0) / duration)
      const e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
      const mid = new Map()
      for (const [id, end] of layout.targets) {
        const start = before.get(id) ?? end
        mid.set(id, {
          ...end,
          x: start.x + (end.x - start.x) * e,
          y: start.y + (end.y - start.y) * e,
        })
      }
      cards.applyFlight(session.from, mid, 1, false)
      if (u < 1) modeRaf = requestAnimationFrame(tick)
    }
    modeRaf = requestAnimationFrame(tick)
  }


  // Swipe over the map, like the Bias Comparison content: finger from the
  // right towards the centre → next style to the right (Smartmap → Types),
  // from the left → to the left (Smartmap → Reliability). One finger only,
  // so pinching still zooms; the button bar has its own swipe.
  const pointers = new Set()
  let swipeStart = null
  root.addEventListener('pointerdown', (event) => {
    pointers.add(event.pointerId)
    swipeStart =
      progress >= 0.999 && pointers.size === 1 && !event.target.closest('.map-bar, .iframe-close')
        ? { x: event.clientX, y: event.clientY }
        : null
  })
  root.addEventListener('pointerup', (event) => {
    pointers.delete(event.pointerId)
    if (!swipeStart || progress < 0.999) return
    const dx = event.clientX - swipeStart.x
    const dy = event.clientY - swipeStart.y
    swipeStart = null
    if (Math.abs(dx) < 24 || Math.abs(dx) < Math.abs(dy)) return
    mapSwitch.step(dx < 0 ? 1 : -1)
  })
  root.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId)
    swipeStart = null
  })

  // X in the overview: back to the cards (runs before cards.js's own X)
  closeButton?.addEventListener(
    'click',
    (event) => {
      if (progress === 0 && !session) return
      event.stopImmediatePropagation()
      animateTo(0)
    },
    true,
  )

  root.addEventListener('parc:overview', (event) => {
    const detail = event.detail
    const target =
      detail === 'open' ? 1 : detail === 'close' ? 0 : progress >= 0.5 ? 0 : 1
    ensureSession()
    animateTo(target)
  })

  return {
    update() {},
    getProgress: () => progress,
  }
}
