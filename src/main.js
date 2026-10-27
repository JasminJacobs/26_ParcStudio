import './styles/main.css'
import articles from './data/articles.json'
import { createSlider } from './interactions/slider.js'
import { createOverview } from './interactions/overview.js'
import { createMic } from './interactions/mic.js'

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

// Bias Comparison: one button active at a time
const biasButtons = app.querySelectorAll('.bias__button')
biasButtons.forEach((button) =>
  button.addEventListener('click', () => {
    biasButtons.forEach((b) => b.setAttribute('aria-pressed', b === button))
  }),
)

// Interactions (slider, overview, mic) — mounted once their Figma frames are built.
// Until then they would draw placeholder layers over the article page.
function mountInteractions() {
  const slider = createSlider(app, state)
  const overview = createOverview(app, state)
  const mic = createMic()

  function render() {
    slider.update(state)
    overview.update(state)
  }

  // Blowing into the mic toggles the "most read" filter
  mic.on('blow', () => {
    state.filter = state.filter === 'all' ? 'most-read' : 'all'
    render()
  })

  render()
}
