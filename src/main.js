import './styles/main.css'
import articles from './data/articles.json'
import { createSlider } from './interactions/slider.js'
// import { createOverview } from './interactions/overview.js'
import { createMic } from './interactions/mic.js'
import { createCards } from './cards.js'
import { createCarouselSlider } from './carousel-slider.js'

const app = document.querySelector('#app')

// Shared state for all interactions
const state = {
  articles,
  filter: 'all', // 'all' | 'most-read'
  view: 'slider', // 'slider' | 'overview'
}

const slider = createSlider(app, state)
// const overview = createOverview(app, state)
const mic = createMic()
const cards = createCards(app, state)
const carouselSlider = createCarouselSlider(app, () => cards.getTrack())

function render() {
  slider.update(state)
  // overview.update(state)
  cards.update(state)
  requestAnimationFrame(() => {
    carouselSlider.refresh()
    cards.updateCardScales?.()
  })
}

// Switch between the gallery and the zoomed-out overview
export function setView(view) {
  state.view = view
  render()
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