import { visibleArticles } from './interactions/slider.js'
import sourceColors from './data/source-colors.json'

const BIAS_ORDER = [
  'farleft',
  'left',
  'leanleft',
  'centre',
  'leanright',
  'right',
  'farright',
]

function articlesByBias(articles) {
  const rank = (bias) => {
    const index = BIAS_ORDER.indexOf(bias)
    return index === -1 ? BIAS_ORDER.length : index
  }
  return [...articles].sort((a, b) => {
    const byBias = rank(a.bias) - rank(b.bias)
    return byBias !== 0 ? byBias : a.id - b.id
  })
}

function relativeLuminance(hex) {
  const raw = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255)
  return channels
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0)
}

function cardSurface(source) {
  const colors = sourceColors[source] ?? ['#6b6b6b', '#2a2a2a']
  const background = `linear-gradient(180deg, ${colors.join(', ')})`
  const luminance = relativeLuminance(colors[0])
  const color = luminance > 0.55 ? '#000000' : '#ffffff'
  return { background, color }
}

function cardMarkup(article) {
  const { background, color } = cardSurface(article.source)
  return `
    <article
      class="card"
      data-id="${article.id}"
      data-bias="${article.bias}"
      data-source="${article.source}"
      style="background: ${background}; color: ${color}"
    >
      <h2 class="card-title">${article.title}</h2>
      <label class="card-source">${article.source}</label>
    </article>`
}

export function createCards(root, state) {
  const section = root.querySelector('.cards')
  if (!section) return { update() {} }

  let track = section.querySelector('.cards-track')
  if (!track) {
    track = document.createElement('div')
    track.className = 'cards-track'
    section.append(track)
  }

  track.addEventListener('click', (event) => {
    const card = event.target.closest('.card')
    if (!card) return
    console.log('card clicked', card.dataset.id)
  })

  let scaleFrame = 0

  function updateCardScales() {
    scaleFrame = 0
    const cardEls = track.querySelectorAll('.card')
    if (!cardEls.length) return

    const bounds = track.getBoundingClientRect()
    const center = bounds.left + bounds.width / 2
    const cardWidth = cardEls[0].getBoundingClientRect().width

    let active = cardEls[0]
    let activeDist = Infinity

    for (const card of cardEls) {
      const rect = card.getBoundingClientRect()
      const dist = Math.abs(rect.left + rect.width / 2 - center)
      const t = Math.min(dist / Math.max(cardWidth, 1), 1)
      const scale = 1 - t * 0.1
      card.style.transform = `scale(${scale})`
      card.style.zIndex = String(10 - Math.round(dist))
      if (dist < activeDist) {
        activeDist = dist
        active = card
      }
    }

    for (const card of cardEls) {
      card.classList.toggle('is-center', card === active)
    }
  }

  function requestScaleUpdate() {
    if (scaleFrame) return
    scaleFrame = requestAnimationFrame(updateCardScales)
  }

  track.addEventListener('scroll', requestScaleUpdate, { passive: true })
  new ResizeObserver(requestScaleUpdate).observe(track)

  function update(nextState) {
    const max = Math.max(0, track.scrollWidth - track.clientWidth)
    const ratio = max === 0 ? 0 : track.scrollLeft / max

    const articles = articlesByBias(visibleArticles(nextState))
    track.innerHTML = articles.map(cardMarkup).join('')

    requestAnimationFrame(() => {
      const nextMax = Math.max(0, track.scrollWidth - track.clientWidth)
      track.scrollLeft = ratio * nextMax
      updateCardScales()
    })
  }

  update(state)

  return { update, getTrack: () => track, updateCardScales }
}
