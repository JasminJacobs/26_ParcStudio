import './styles/main.css'
import articles from './data/articles.json'
import { createOverview } from './interactions/overview.js'
import { createHint } from './interactions/hint.js'
import { createMic } from './interactions/mic.js'
import { createCards } from './cards.js'
import { createCarouselSlider } from './carousel-slider.js'

const app = document.querySelector('#app')

// Desktop preview: scale the phone to its real height (--device-h in tokens.css)
if (matchMedia('(min-width: 600px)').matches) {
  const css = getComputedStyle(document.documentElement)
  const px = (name) => parseFloat(css.getPropertyValue(name))
  // Always the real phone's scale, so a shorter --frame-h stays true to size
  app.style.zoom = px('--device-h') / (px('--screen-h-real') + 2 * px('--bezel'))
}

const scroller = app.querySelector('.scroller')
const title = app.querySelector('.article__title')
const gallery = app.querySelector('.gallery')
const biasBar = app.querySelector('.bias')
const biasButtons = app.querySelectorAll('.bias__button')
const summaryBlock = app.querySelector('.summaries')
const summaries = app.querySelectorAll('.summary')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// Screen px per layout px (the phone mockup is scaled with CSS zoom)
const zoom = () => scroller.getBoundingClientRect().height / scroller.clientHeight || 1
// Where an element's top is in the scrolled page (layout px)
const pageTop = (el) =>
  (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / zoom() +
  scroller.scrollTop

/* ---------- First screen: gallery fills the space under the title ---------- */
// Cards and slider bar are visible without scrolling (--gallery-h, article.css)
function fitGallery() {
  const top = gallery.offsetTop - scroller.offsetTop
  gallery.style.setProperty('--gallery-h', `${Math.max(360, scroller.clientHeight - top)}px`)
}
fitGallery()
document.fonts?.ready.then(fitGallery) // the title wraps differently once the font is in
window.addEventListener('resize', fitGallery)

/* ---------- Sticky title ---------- */
// It sticks --title-top below the header (article.css). Two things depend on it:
// --title-bottom: where the stuck title ends; the Bias Comparison bar sticks there
// .is-stuck:      set while it sticks; shows the line under it (article.css)
const titleTop = () => parseFloat(getComputedStyle(title).top) || 0
function setTitleBottom() {
  // exact height incl. fractions (offsetHeight rounds, which left a hairline gap)
  const height = title.getBoundingClientRect().height / zoom()
  app.style.setProperty('--title-bottom', `${titleTop() + height}px`)
}
setTitleBottom()
new ResizeObserver(setTitleBottom).observe(title)

scroller.addEventListener(
  'scroll',
  () => {
    const stuck = scroller.scrollTop > 0 && pageTop(title) - scroller.scrollTop <= titleTop() + 0.5
    title.classList.toggle('is-stuck', stuck)
  },
  { passive: true },
)

/* ---------- Bias Comparison ---------- */
// The active button colours itself (200ms, article.css) and its summary slides
// in from the button's side; the old one slides out to the other side.
const biasOrder = ['left', 'center', 'right']
let activeBias = 'center'

// Start position of the summaries: bar stuck under the title, list 16px below.
// If the page is scrolled further, jump back there and return how far (px).
function jumpToSummaryStart() {
  const gap = parseFloat(getComputedStyle(biasBar.parentElement).rowGap) || 0
  const titleBottom = parseFloat(getComputedStyle(app).getPropertyValue('--title-bottom')) || 0
  const target = pageTop(summaryBlock) - (titleBottom + biasBar.offsetHeight + gap)
  const dy = scroller.scrollTop - target
  if (dy <= 1) return 0
  scroller.scrollTo({ top: target, behavior: 'instant' })
  return dy
}

function showBias(bias) {
  if (bias === activeBias) return
  const dir = biasOrder.indexOf(bias) > biasOrder.indexOf(activeBias) ? 1 : -1 // +1: from the right
  const from = app.querySelector(`.summary[data-bias="${activeBias}"]`)
  const to = app.querySelector(`.summary[data-bias="${bias}"]`)
  activeBias = bias
  biasButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.bias === bias))

  // dy: how far the page jumped back; the old list is held at its old height
  // by it, so both lists only move sideways
  const dy = jumpToSummaryStart()

  // finish a slide still running from a quick previous click
  summaries.forEach((s) => s.getAnimations().forEach((a) => a.finish()))
  summaries.forEach((s) => (s.hidden = s !== to && s !== from))
  to.hidden = false
  if (reduceMotion) {
    from.hidden = true
    return
  }

  const shift = (d) => `translateX(calc(${d * 100}% + ${d * 16}px))`
  const hold = dy ? ` translateY(${-dy}px)` : ''
  const timing = { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  to.animate([{ transform: shift(dir) }, { transform: 'none' }], timing)
  from
    .animate([{ transform: `translateX(0)${hold}` }, { transform: shift(-dir) + hold }], timing)
    .finished.then(() => (from.hidden = activeBias !== from.dataset.bias))
}

biasButtons.forEach((button) =>
  button.addEventListener('click', () => showBias(button.dataset.bias)),
)

/* ---------- Hint ---------- */
createHint(app, scroller)

// Shared state for all interactions
const state = {
  articles,
  filter: 'all', // 'all' | 'most-read'
  view: 'slider', // 'slider' | 'overview'
}

const mic = createMic()
let carouselSlider = null
const cards = createCards(app, state, {
  onOpenChange: () => carouselSlider?.refresh(),
})
carouselSlider = createCarouselSlider(
  app,
  () => cards.getTrack(),
  () => cards.getArticles(),
)
const overview = createOverview(app, state, cards, {
  onViewChange(view) {
    state.view = view
    if (view === 'slider') {
      requestAnimationFrame(() => {
        carouselSlider.refresh()
        cards.updateCardScales?.()
      })
    }
  },
})

function render() {
  cards.update(state)
  overview.update(state)
  requestAnimationFrame(() => {
    carouselSlider.refresh()
    cards.updateCardScales?.()
  })
}

// Switch between the gallery and the zoomed-out overview
export function setView(view) {
  app.dispatchEvent(
    new CustomEvent('parc:overview', {
      detail: view === 'overview' ? 'open' : 'close',
    }),
  )
}

// Blowing into the mic toggles the "most read" filter
mic.on('blow', () => {
  state.filter = state.filter === 'all' ? 'most-read' : 'all'
  render()
})

render()
