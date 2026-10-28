/*
  Slider bar — every article is one block of the same width in its tag colour,
  so the bar is as long as the coverage: 10 articles make a short bar, 1000 a long one.

  The bar moves under the fixed centre marker. The article under the marker is the
  one centred in the gallery (cards, or the screenshots while the popup is open).

  One shared position: `pos`, 0 … n−1 (fractional while moving), read from the
  visible track. Dragging the bar scrolls the track; swiping the track moves the bar.
*/
import { BIAS_ORDER } from './cards.js'

// Width per article on the bar: set as --bar-unit on .slider-container in main.css
let UNIT = 12
// Gap between two blocks: --bar-gap in main.css
let GAP = 0

// Tag names shown under the marker
const TAG_NAMES = {
  farleft: 'Far Left',
  left: 'Left',
  leanleft: 'Lean Left',
  centre: 'Centre',
  leanright: 'Lean Right',
  right: 'Right',
  farright: 'Far Right',
}

// How the tag under the marker changes: 'slide' | 'roll' | 'fade' | 'none'
//   slide: the old word leaves with the bar, the new one comes in from the other side
//   roll:  the words roll up or down, like a split-flap display
//   fade:  the old word fades out while the new one fades in
const LABEL_TRANSITION = 'slide'
const LABEL_DURATION = 220 // ms

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// Centre of each item, in the track's scroll coordinates
function itemCentres(track) {
  return [...track.children].map((el) => el.offsetLeft + el.offsetWidth / 2)
}

// Track scroll → position on the bar
function posFromTrack(track) {
  const c = itemCentres(track)
  if (c.length < 2) return 0
  const v = track.scrollLeft + track.clientWidth / 2
  if (v <= c[0]) return 0
  for (let i = 0; i < c.length - 1; i++) {
    if (v <= c[i + 1]) return i + (v - c[i]) / (c[i + 1] - c[i])
  }
  return c.length - 1
}

// Position on the bar → track scroll
function scrollForPos(track, pos) {
  const c = itemCentres(track)
  if (!c.length) return 0
  const i = clamp(Math.floor(pos), 0, c.length - 1)
  const next = Math.min(i + 1, c.length - 1)
  const x = c[i] + (c[next] - c[i]) * (pos - i)
  return x - track.clientWidth / 2
}

// Centre zone on the bar, as [start, end] in article units (article i spans i … i+1)
function centreZone(articles) {
  const centre = articles
    .map((a, i) => (a.bias === 'centre' ? i : -1))
    .filter((i) => i !== -1)
  if (centre.length) return [centre[0], centre[centre.length - 1] + 1]

  // No centre articles: the edge between left-leaning and right-leaning
  const centreRank = BIAS_ORDER.indexOf('centre')
  let edge = articles.findIndex((a) => BIAS_ORDER.indexOf(a.bias) > centreRank)
  if (edge === -1) edge = articles.length
  return [edge, edge]
}

export function createCarouselSlider(root, getTrack, getArticles = () => []) {
  const container = root.querySelector('.slider-container')
  if (!container) return { refresh() {} }

  UNIT = parseFloat(getComputedStyle(container).getPropertyValue('--bar-unit')) || UNIT
  GAP = parseFloat(getComputedStyle(container).getPropertyValue('--bar-gap')) || 0
  // The markup is in index.html (.slider-container)

  const rail = container.querySelector('.carousel-slider__rail')
  const bar = container.querySelector('.slider-bar')
  const label = container.querySelector('.carousel-label')
  label.dataset.transition = LABEL_TRANSITION
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

  container.setAttribute('role', 'slider')
  container.setAttribute('aria-label', 'Browse stories')
  container.tabIndex = 0

  let articles = []
  let zone = [0, 0]
  let barKey = ''
  let pos = 0
  let labelIndex = -1
  let currentBlock = null

  // Swap the word under the marker. dir: +1 when moving to a later article
  // (the bar moves left), −1 when moving to an earlier one.
  function setLabel(text, dir) {
    const current = label.lastElementChild
    if (current?.textContent === text) return

    // On fast drags, drop words that are still leaving
    ;[...label.children].slice(0, -1).forEach((el) => el.remove())

    const next = document.createElement('span')
    next.textContent = text
    label.append(next)
    if (!current || LABEL_TRANSITION === 'none' || reduceMotion.matches) {
      current?.remove()
      return
    }

    const move = {
      slide: (d) => `translateX(${d * 16}px)`,
      roll: (d) => `translateY(${d * 100}%)`,
      fade: () => 'none',
    }[LABEL_TRANSITION]
    const timing = { duration: LABEL_DURATION, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    current.animate(
      [{ transform: 'none', opacity: 1 }, { transform: move(-dir), opacity: 0 }],
      timing,
    ).finished.then(() => current.remove(), () => {})
    next.animate([{ transform: move(dir), opacity: 0 }, { transform: 'none', opacity: 1 }], timing)
  }

  function renderBar() {
    articles = getArticles()
    const key = articles.map((a) => `${a.id}:${a.bias}`).join(',')
    if (key === barKey) return
    barKey = key

    // One block per article, so the one under the marker can grow on its own
    bar.style.width = `${articles.length * UNIT}px`
    bar.innerHTML = articles
      .map((a) => `<span class="slider-bar__block" data-bias="${a.bias}"></span>`)
      .join('')
    currentBlock = null
    zone = centreZone(articles)
    container.setAttribute('aria-valuemin', '1')
    container.setAttribute('aria-valuemax', String(articles.length))
  }

  // Move the bar so article `pos` sits under the centre marker
  function place(nextPos) {
    pos = nextPos
    // Block i starts at i × UNIT and is (UNIT − GAP) wide: put its middle on the marker
    bar.style.transform = `translate3d(${-(pos * UNIT + (UNIT - GAP) / 2)}px, 0, 0)`

    const index = Math.round(pos)
    const article = articles[index]

    // Mark the block under the marker (it grows while dragging, see main.css)
    const block = bar.children[index] ?? null
    if (block !== currentBlock) {
      currentBlock?.classList.remove('is-current')
      currentBlock?.previousElementSibling?.classList.remove('is-near')
      currentBlock?.nextElementSibling?.classList.remove('is-near')
      block?.classList.add('is-current')
      // the closest block before and after grow a little too
      block?.previousElementSibling?.classList.add('is-near')
      block?.nextElementSibling?.classList.add('is-near')
      currentBlock = block
    }

    // The label under the marker names the tag of the article under it
    if (index !== labelIndex) {
      setLabel(TAG_NAMES[article?.bias] ?? '', index > labelIndex ? 1 : -1)
      labelIndex = index
    }
    container.setAttribute('aria-valuenow', String(index + 1))
    if (article) container.setAttribute('aria-valuetext', `${article.source}, ${article.bias}`)
  }

  function syncFromTrack() {
    if (drag || settleRaf) return
    const track = getTrack()
    if (track) place(posFromTrack(track))
  }

  // How much the bar is scaled up while dragging (--bar-drag-scale in main.css),
  // so the bar stays under the finger
  function dragScale() {
    return parseFloat(getComputedStyle(container).getPropertyValue('--bar-drag-scale')) || 1
  }

  // Screen px per layout px (the phone mockup is scaled with CSS zoom)
  function screenScale() {
    return rail.getBoundingClientRect().width / Math.max(rail.offsetWidth, 1)
  }

  function scrollTo(nextPos) {
    const track = getTrack()
    if (!track || !articles.length) return
    const p = clamp(nextPos, 0, articles.length - 1)
    track.scrollLeft = scrollForPos(track, p)
    place(p)
  }

  function stopSettle() {
    cancelAnimationFrame(settleRaf)
    settleRaf = 0
  }

  function settleTo(target, onDone) {
    stopSettle()
    const start = pos
    const dest = clamp(target, 0, Math.max(0, articles.length - 1))
    const dist = dest - start
    if (Math.abs(dist) < 0.002) {
      scrollTo(dest)
      onDone?.()
      return
    }
    const duration = 280
    const t0 = performance.now()
    function tick(now) {
      const u = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - u) ** 3
      scrollTo(start + dist * eased)
      if (u < 1) {
        settleRaf = requestAnimationFrame(tick)
        return
      }
      settleRaf = 0
      onDone?.()
    }
    settleRaf = requestAnimationFrame(tick)
  }

  // Drag: the bar follows the finger, so dragging left brings later articles in
  let drag = null
  let settleRaf = 0

  container.addEventListener('pointerdown', (event) => {
    const track = getTrack()
    if (!track || !articles.length) return
    event.preventDefault()
    event.stopPropagation()
    stopSettle()

    // Turn snap off without letting iOS shift the scroll position
    const sl = track.scrollLeft
    track.classList.add('is-scrubbing')
    track.scrollLeft = sl
    place(posFromTrack(track))

    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startPos: pos,
      moved: false,
      primed: false,
    }
    container.classList.add('is-dragging')
    try {
      container.setPointerCapture(event.pointerId)
    } catch {
      /* iOS may throw if capture is not supported */
    }
  })

  container.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    // Capture / the first touchmove often reports a bogus clientX on iOS
    if (!drag.primed) {
      drag.startX = event.clientX
      drag.startPos = pos
      drag.primed = true
      return
    }
    const dx = (event.clientX - drag.startX) / screenScale()
    if (Math.abs(dx) > 3) drag.moved = true
    scrollTo(drag.startPos - dx / (UNIT * dragScale()))
  })

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return
    const track = getTrack()
    let target = Math.round(pos)

    // A tap without dragging jumps to the article that was tapped
    if (!drag.moved) {
      const r = rail.getBoundingClientRect()
      const x = (event.clientX - (r.left + r.width / 2)) / screenScale()
      target = Math.round(pos + x / (UNIT * dragScale()))
    }

    drag = null
    container.classList.remove('is-dragging')
    settleTo(target, () => track?.classList.remove('is-scrubbing'))
  }

  container.addEventListener('pointerup', endDrag)
  container.addEventListener('pointercancel', endDrag)
  container.addEventListener('lostpointercapture', endDrag)

  // Trackpad: a sideways swipe over the bar moves it the same way
  let wheelTimer = 0
  container.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      const track = getTrack()
      stopSettle()
      track?.classList.add('is-scrubbing')
      scrollTo(pos + event.deltaX / screenScale() / UNIT)
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        settleTo(Math.round(pos), () => track?.classList.remove('is-scrubbing'))
      }, 140)
    },
    { passive: false },
  )

  // Keyboard: arrows step one article
  container.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (!step) return
    event.preventDefault()
    const track = getTrack()
    track?.classList.add('is-scrubbing')
    settleTo(Math.round(pos) + step, () => track?.classList.remove('is-scrubbing'))
  })

  // Swiping the cards (or screenshots) moves the bar
  let trackBound = null
  let frame = 0
  const requestSync = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), syncFromTrack()))
  }
  const resizeObserver = new ResizeObserver(requestSync)

  function bindTrack() {
    const track = getTrack()
    if (!track || track === trackBound) return
    if (trackBound) {
      trackBound.removeEventListener('scroll', requestSync)
      resizeObserver.disconnect()
    }
    trackBound = track
    track.addEventListener('scroll', requestSync, { passive: true })
    resizeObserver.observe(track)
  }

  // Start in the middle of the centre zone (or the middle article if there is none)
  let started = false
  function startInCentre() {
    const track = getTrack()
    if (started || !track || !track.clientWidth || !articles.length) return
    started = true
    const [a, b] = zone
    const middle = b > a ? (a + b - 1) / 2 : (articles.length - 1) / 2
    // With an even count, take the left one of the two middle articles
    scrollTo(Math.floor(middle))
  }

  function refresh() {
    bindTrack()
    renderBar()
    startInCentre()
    syncFromTrack()
  }

  return { refresh }
}
