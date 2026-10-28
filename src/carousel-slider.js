/*
  Slider bar — every article is one block of the same width in its tag colour,
  so the bar is as long as the coverage: 10 articles make a short bar, 1000 a long one.

  The bar moves under the fixed centre marker. The article under the marker is the
  one centred in the gallery (cards, or the screenshots while the popup is open).

  One shared position: `pos`, 0 … n−1 (fractional while moving), read from the
  visible track. Dragging the bar scrolls the track; swiping the track moves the bar.
*/
import { BIAS_ORDER } from './cards.js'

const UNIT = 16 // px per article on the bar (14px block + 2px gap, see .slider-bar)

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

// Consecutive articles with the same tag become one coloured segment
function segments(articles) {
  const runs = []
  for (const a of articles) {
    const last = runs[runs.length - 1]
    if (last && last.bias === a.bias) last.count++
    else runs.push({ bias: a.bias, count: 1 })
  }
  return runs
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

  container.style.setProperty('--bar-unit', `${UNIT}px`)
  container.innerHTML = `
    <div class="carousel-slider">
      <div class="carousel-slider__rail">
        <div class="slider-bar" aria-hidden="true"></div>
        <div class="carousel-slider__thumb" aria-hidden="true"></div>
      </div>
      <div class="carousel-label" id="carousel-label-left">Left</div>
      <div class="carousel-label" id="carousel-label-centre">Centre</div>
      <div class="carousel-label" id="carousel-label-right">Right</div>
    </div>`

  const rail = container.querySelector('.carousel-slider__rail')
  const bar = container.querySelector('.slider-bar')

  container.setAttribute('role', 'slider')
  container.setAttribute('aria-label', 'Browse stories')
  container.tabIndex = 0

  let articles = []
  let zone = [0, 0]
  let barKey = ''
  let pos = 0

  function renderBar() {
    articles = getArticles()
    const key = articles.map((a) => `${a.id}:${a.bias}`).join(',')
    if (key === barKey) return
    barKey = key

    bar.style.width = `${articles.length * UNIT}px`
    bar.innerHTML = segments(articles)
      .map(
        (s) =>
          `<span class="slider-bar__segment" data-bias="${s.bias}" style="flex-basis:${s.count * UNIT}px"></span>`,
      )
      .join('')
    zone = centreZone(articles)
    container.setAttribute('aria-valuemin', '1')
    container.setAttribute('aria-valuemax', String(articles.length))
  }

  // Move the bar so article `pos` sits under the centre marker
  function place(nextPos) {
    pos = nextPos
    bar.style.transform = `translate3d(${-(pos + 0.5) * UNIT}px, 0, 0)`

    // The Centre label stays with the centre zone on the bar
    const w = rail.clientWidth || 1
    const edge = (i) => clamp((w / 2 + (i - pos - 0.5) * UNIT) / w, 0, 1)
    container.style.setProperty('--centre', (edge(zone[0]) + edge(zone[1])) / 2)

    const index = Math.round(pos)
    const article = articles[index]
    container.setAttribute('aria-valuenow', String(index + 1))
    if (article) container.setAttribute('aria-valuetext', `${article.source}, ${article.bias}`)
  }

  function syncFromTrack() {
    const track = getTrack()
    if (track) place(posFromTrack(track))
  }

  // Screen px per layout px (the phone mockup is scaled with CSS zoom)
  function screenScale() {
    return rail.getBoundingClientRect().width / Math.max(rail.offsetWidth, 1)
  }

  function scrollTo(nextPos, smooth) {
    const track = getTrack()
    if (!track || !articles.length) return
    const p = clamp(nextPos, 0, articles.length - 1)
    if (smooth) {
      track.scrollTo({ left: scrollForPos(track, p), behavior: 'smooth' })
    } else {
      track.scrollLeft = scrollForPos(track, p)
      place(p)
    }
  }

  // Drag: the bar follows the finger, so dragging left brings later articles in
  let drag = null

  container.addEventListener('pointerdown', (event) => {
    const track = getTrack()
    if (!track || !articles.length) return
    event.preventDefault()
    event.stopPropagation()
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startPos: pos,
      moved: false,
    }
    container.classList.add('is-dragging')
    track.classList.add('is-scrubbing')
    container.setPointerCapture(event.pointerId)
  })

  container.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    const dx = (event.clientX - drag.startX) / screenScale()
    if (Math.abs(dx) > 3) drag.moved = true
    scrollTo(drag.startPos - dx / UNIT, false)
  })

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return
    const track = getTrack()
    let target = Math.round(pos)

    // A tap without dragging jumps to the article that was tapped
    if (!drag.moved) {
      const r = rail.getBoundingClientRect()
      const x = (event.clientX - (r.left + r.width / 2)) / screenScale()
      target = Math.round(pos + x / UNIT)
    }

    drag = null
    container.classList.remove('is-dragging')
    track?.classList.remove('is-scrubbing')
    scrollTo(target, true)
  }

  container.addEventListener('pointerup', endDrag)
  container.addEventListener('pointercancel', endDrag)

  // Trackpad: a sideways swipe over the bar moves it the same way
  let wheelTimer = 0
  container.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      const track = getTrack()
      track?.classList.add('is-scrubbing')
      scrollTo(pos + event.deltaX / screenScale() / UNIT, false)
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        track?.classList.remove('is-scrubbing')
        scrollTo(Math.round(pos), true)
      }, 140)
    },
    { passive: false },
  )

  // Keyboard: arrows step one article
  container.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (!step) return
    event.preventDefault()
    scrollTo(Math.round(pos) + step, true)
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
    scrollTo(Math.round(middle), false)
  }

  function refresh() {
    bindTrack()
    renderBar()
    startInCentre()
    syncFromTrack()
  }

  return { refresh }
}
