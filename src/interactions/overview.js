/*
  Pinch in (zoom out) from a card or iframe → open field of source labels,
  clustered by article type. Pinch out (spread) returns to the carousel.
*/
const CLUSTER_ANCHORS = {
  Socialist: { x: 0.28, y: 0.20 },
  Ecologist: { x: 0.78, y: 0.20 },
  Liberal: { x: 0.50, y: 0.48 },
  'Neo-liberal': { x: 0.28, y: 0.78 },
  Conservative: { x: 0.74, y: 0.78 },
}

const CHIP_H = 28
const CHIP_PAD_X = 10
const PINCH_RANGE = 0.42

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

function fieldBox(layer) {
  const w = layer.clientWidth
  const h = layer.clientHeight
  const top = 108
  const bottom = 28
  const side = 18
  return { x: side, y: top, w: w - side * 2, h: h - top - bottom }
}

let measureCtx
function textWidth(text) {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx.font = '12px Medway, "Helvetica Neue", sans-serif'
  return measureCtx.measureText(text).width
}

function chipSize(source) {
  const w = Math.min(
    168,
    Math.max(52, Math.ceil(textWidth(source || '')) + CHIP_PAD_X * 2),
  )
  return { w, h: CHIP_H }
}

function columnCount(n) {
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 1
  return 2
}

function layoutClusters(from, layer) {
  const field = fieldBox(layer)
  const groups = new Map()

  for (const [id, item] of from) {
    const type = item.type || 'Other'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push({ id, ...item })
  }

  const targets = new Map()
  const clusters = []

  for (const [type, members] of groups) {
    const anchor = CLUSTER_ANCHORS[type] ?? { x: 0.5, y: 0.5 }
    const cx = field.x + anchor.x * field.w
    const cy = field.y + anchor.y * field.h
    const n = members.length
    const sizes = members.map((item) => chipSize(item.source))
    const cols = columnCount(n)
    const rows = Math.ceil(n / cols)
    const gapX = 8
    const gapY = 8
    const colW = Math.max(...sizes.map((s) => s.w)) + gapX
    const rowH = CHIP_H + gapY
    const gridW = cols * colW - gapX
    const gridH = rows * rowH - gapY
    const originX = cx - gridW / 2
    const originY = cy - gridH / 2

    members.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const { w, h } = sizes[i]
      const jitter = (hash01(Number(item.id) * 7.13) - 0.5) * (cols === 1 ? 16 : 6)
      const stagger = cols > 1 && row % 2 === 1 ? 12 : 0
      let x = originX + col * colW + stagger + jitter
      let y = originY + row * rowH + jitter * 0.3
      x = Math.min(field.x + field.w - w, Math.max(field.x, x))
      y = Math.min(field.y + field.h - h, Math.max(field.y, y))
      targets.set(String(item.id), { x, y, w, h, type })
    })

    const placed = members.map((m) => targets.get(String(m.id)))
    const midX = placed.reduce((sum, p) => sum + p.x + p.w / 2, 0) / n
    const midY = placed.reduce((sum, p) => sum + p.y + p.h / 2, 0) / n
    const minY = Math.min(...placed.map((p) => p.y))
    const maxSpan = Math.max(
      56,
      ...placed.map((p) => {
        const dx = p.x + p.w / 2 - midX
        const dy = p.y + p.h / 2 - midY
        return Math.hypot(dx, dy) + Math.max(p.w, p.h) * 0.5
      }),
    )

    clusters.push({
      type,
      x: midX,
      y: Math.max(field.y + 8, minY - 16),
      cx: midX,
      cy: midY,
      r: maxSpan * 2 + 28,
    })
  }

  return { targets, clusters }
}

export function createOverview(root, state, cards, { onViewChange } = {}) {
  const map = document.createElement('section')
  map.className = 'map'
  map.setAttribute('aria-label', 'Sources by type')
  map.setAttribute('aria-hidden', 'true')
  root.append(map)

  const headline = root.querySelector('.headline')
  const slider = root.querySelector('.slider-container')
  const iframes = root.querySelector('.iframes')

  let progress = state.view === 'overview' ? 1 : 0
  let session = null
  let pinch = null
  let raf = 0
  let wheelTimer = 0

  function renderClusters(clusters) {
    map.innerHTML = clusters
      .map(
        (cluster) => `
        <div class="map-cluster" data-type="${cluster.type}">
          <div
            class="map-cluster-blob"
            style="left:${cluster.cx}px;top:${cluster.cy}px;width:${cluster.r}px;height:${cluster.r}px"
          ></div>
          <div
            class="map-cluster-label"
            style="left:${cluster.x}px;top:${cluster.y}px"
          >${cluster.type}</div>
        </div>`,
      )
      .join('')
  }

  function applyChrome(t, wasOpen) {
    root.style.setProperty('--overview-progress', String(t))
    root.classList.toggle('is-overviewing', t > 0 && t < 1)
    root.classList.toggle('is-overview', t >= 0.999)
    map.setAttribute('aria-hidden', t > 0.2 ? 'false' : 'true')

    if (headline) {
      headline.style.opacity = t ? String(1 - t) : ''
      headline.style.pointerEvents = t > 0.15 ? 'none' : ''
    }
    if (slider) {
      slider.style.opacity = t ? String(1 - t) : ''
      slider.style.pointerEvents = t > 0.15 ? 'none' : ''
    }

    if (!iframes) return
    if (wasOpen) {
      iframes.style.opacity = String(1 - t)
      iframes.style.transform = `scale(${1 - t * 0.08})`
      iframes.style.pointerEvents = 'none'
      iframes.style.visibility = t >= 0.999 ? 'hidden' : 'visible'
      iframes.style.transition = 'none'
    } else if (t === 0) {
      iframes.style.opacity = ''
      iframes.style.transform = ''
      iframes.style.pointerEvents = ''
      iframes.style.visibility = ''
      iframes.style.transition = ''
    }
  }

  function clearIframeInline() {
    if (!iframes) return
    iframes.style.opacity = ''
    iframes.style.transform = ''
    iframes.style.pointerEvents = ''
    iframes.style.visibility = ''
    iframes.style.transition = ''
  }

  function ensureSession() {
    if (session) return session
    const wasOpen = cards.isOpen()
    const from = cards.beginFlight()
    const layout = layoutClusters(from, cards.getLayer())
    renderClusters(layout.clusters)
    session = { from, to: layout.targets, wasOpen }
    return session
  }

  function setProgress(t) {
    progress = clamp(t, 0, 1)
    const current = ensureSession()
    cards.applyFlight(current.from, current.to, progress)
    applyChrome(progress, current.wasOpen)
  }

  function finish(target) {
    setProgress(target)
    if (target === 0) {
      if (session?.wasOpen) cards.setOpen(true)
      cards.endFlight()
      session = null
      applyChrome(0, false)
      clearIframeInline()
      map.innerHTML = ''
      onViewChange?.('slider')
      return
    }

    if (session?.wasOpen) {
      cards.setOpen(false)
      session.wasOpen = false
    }
    clearIframeInline()
    onViewChange?.('overview')
  }

  function animateTo(target) {
    cancelAnimationFrame(raf)
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

  function onTouchStart(event) {
    if (event.touches.length < 2 || onSlider(event)) return
    event.preventDefault()
    cancelAnimationFrame(raf)
    clearTimeout(wheelTimer)
    ensureSession()
    pinch = {
      startDist: distance(touchPoint(event.touches, 0), touchPoint(event.touches, 1)),
      startProgress: progress,
    }
  }

  function onTouchMove(event) {
    if (!pinch || event.touches.length < 2) return
    event.preventDefault()
    const dist = distance(touchPoint(event.touches, 0), touchPoint(event.touches, 1))
    const scale = dist / Math.max(pinch.startDist, 1)
    setProgress(pinch.startProgress + (1 - scale) / PINCH_RANGE)
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
    if (!event.ctrlKey || onSlider(event)) return
    event.preventDefault()
    cancelAnimationFrame(raf)
    ensureSession()
    setProgress(progress + event.deltaY * 0.0035)
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
  root.addEventListener('wheel', onWheel, { passive: false })
  root.addEventListener('gesturestart', killGesture)
  root.addEventListener('gesturechange', killGesture)
  root.addEventListener('gestureend', killGesture)

  cards.getLayer().addEventListener('click', (event) => {
    if (progress < 0.98) return
    const card = event.target.closest('.card')
    if (!card) return
    cards.centerById(card.dataset.id)
    if (session) session.from = cards.measureHomes()
    animateTo(0)
  })

  window.addEventListener('resize', () => {
    if (!session || progress === 0) return
    const layout = layoutClusters(session.from, cards.getLayer())
    session.to = layout.targets
    renderClusters(layout.clusters)
    cards.applyFlight(session.from, session.to, progress)
  })

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
