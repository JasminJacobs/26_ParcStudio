import './styles/main.css'
import articles from './data/articles.json'
import { createSlider } from './interactions/slider.js'
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