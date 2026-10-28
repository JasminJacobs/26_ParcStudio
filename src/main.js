import './styles/main.css'
import articles from './data/articles.json'
import { createSlider } from './interactions/slider.js'
import { createOverview } from './interactions/overview.js'
import { createMic } from './interactions/mic.js'
import { createCards } from './cards.js'
import { createCarouselSlider } from './carousel-slider.js'
import { createScrollLock } from './interactions/scroll-lock.js'

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

// Article scrolls freely, the gallery locks to the screen
createScrollLock(app.querySelector('.scroller'), app.querySelector('.gallery'))

// Sticky title: mark it once it is stuck 36px below the header.
// It sticks when the meta above it has scrolled to within 36px of the top.
const scroller = app.querySelector('.scroller')
const title = app.querySelector('.article__title')
const meta = app.querySelector('.meta')
scroller.addEventListener(
  'scroll',
  () => {
    const titleSlot = meta.offsetTop + meta.offsetHeight + 16 + 8 - scroller.offsetTop // gap + margin
    title.classList.toggle('is-stuck', scroller.scrollTop >= titleSlot - 36)
  },
  { passive: true },
)

// Shared state for all interactions
const state = {
  articles,
  filter: 'all', // 'all' | 'most-read'
  view: 'slider', // 'slider' | 'overview'
}

const slider = createSlider(app, state)
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
    slider.update(state) // .view.slider gets/loses [hidden] after the pinch
    if (view === 'slider') {
      requestAnimationFrame(() => {
        carouselSlider.refresh()
        cards.updateCardScales?.()
      })
    }
  },
})

function render() {
  slider.update(state)
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