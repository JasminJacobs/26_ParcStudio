import './styles/main.css'
import articles from './data/articles.json'
import { createOverview } from './interactions/overview.js'
import { createMic } from './interactions/mic.js'
import { createCards } from './cards.js'
import { createCarouselSlider } from './carousel-slider.js'

const app = document.querySelector('#app')

// Desktop preview: scale the phone to its real height (--device-h in tokens.css)
if (matchMedia('(min-width: 600px)').matches) {
  const css = getComputedStyle(document.documentElement)
  const px = (name) => parseFloat(css.getPropertyValue(name))
  app.style.zoom = px('--device-h') / (px('--frame-h') + 2 * px('--bezel'))
}

// Bias Comparison: the active button colours itself (200ms, see article.css)
// and its summary slides in from the button's side
const biasOrder = ['left', 'center', 'right']
const biasButtons = app.querySelectorAll('.bias__button')
const summaries = app.querySelectorAll('.summary')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let activeBias = 'center'

function showBias(bias) {
  if (bias === activeBias) return

  // +1: new list comes from the right, −1: from the left
  const dir = biasOrder.indexOf(bias) > biasOrder.indexOf(activeBias) ? 1 : -1
  const from = app.querySelector(`.summary[data-bias="${activeBias}"]`)
  const to = app.querySelector(`.summary[data-bias="${bias}"]`)
  activeBias = bias

  biasButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.bias === bias))

  // Finish any slide still running from a quick previous click
  summaries.forEach((s) => s.getAnimations().forEach((a) => a.finish()))
  summaries.forEach((s) => (s.hidden = s !== to && s !== from))
  to.hidden = false
  if (reduceMotion) {
    from.hidden = true
    return
  }

  const shift = (d) => `translateX(calc(${d * 100}% + ${d * 16}px))` // 16px = side padding
  const timing = { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  to.animate([{ transform: shift(dir) }, { transform: 'none' }], timing)
  from
    .animate([{ transform: 'none' }, { transform: shift(-dir) }], timing)
    .finished.then(() => (from.hidden = activeBias !== from.dataset.bias))
}

biasButtons.forEach((button) =>
  button.addEventListener('click', () => showBias(button.dataset.bias)),
)

// First screen: the gallery fills the space under the title, so the cards and
// the slider bar are visible without scrolling (--gallery-h, article.css)
const gallery = app.querySelector('.gallery')
function fitGallery() {
  const scroll = app.querySelector('.scroller')
  const top = gallery.offsetTop - scroll.offsetTop // gallery top on the first screen
  const h = Math.max(360, scroll.clientHeight - top)
  gallery.style.setProperty('--gallery-h', `${h}px`)
}
fitGallery()
document.fonts?.ready.then(fitGallery) // the title wraps differently once the font is in
window.addEventListener('resize', fitGallery)

// Sticky title: mark it once it is stuck below the header.
// It sticks when the meta above it has scrolled to within --title-top
// (article.css, .article__title) of the top.
const scroller = app.querySelector('.scroller')
const title = app.querySelector('.article__title')
const meta = app.querySelector('.meta')
scroller.addEventListener(
  'scroll',
  () => {
    const gap = parseFloat(getComputedStyle(meta.parentElement).rowGap) || 0
    const titleSlot = meta.offsetTop + meta.offsetHeight + gap + 8 - scroller.offsetTop // gap + title margin
    const top = parseFloat(getComputedStyle(title).top) || 0
    const stuck = scroller.scrollTop >= titleSlot - top
    title.classList.toggle('is-stuck', stuck)
  },
  { passive: true },
)

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

let viewportHeight = window.innerHeight
let viewportWidth = window.innerWidth
console.log("viewportHeight", viewportHeight)
console.log("viewportWidth", viewportWidth)