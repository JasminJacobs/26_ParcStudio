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

const DEFAULT_IFRAME = 'img/screenshot01.png'

const CLOSE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><title>Close</title><path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`

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

function overlayMarkup(article) {
  const src = import.meta.env.BASE_URL + (article.iframe ?? DEFAULT_IFRAME)
  return `
    <section class="iframe-overlay" data-id="${article.id}">
      <div class="iframe-scroll">
        <img src="${src}" alt="${article.source}" draggable="false" />
      </div>
      <button class="iframe-close" type="button" aria-label="Close">${CLOSE_ICON}</button>
    </section>`
}

function ensureTrack(section, className) {
  let track = section.querySelector(`.${className}`)
  if (!track) {
    track = document.createElement('div')
    track.className = className
    section.append(track)
  }
  return track
}

function maxScroll(track) {
  return Math.max(0, track.scrollWidth - track.clientWidth)
}

function scrollRatio(track) {
  const max = maxScroll(track)
  return max === 0 ? 0 : track.scrollLeft / max
}

function centerOffset(track, item) {
  return item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2
}

// Centre item at full size, neighbours down to 0.9
function scaleItems(track) {
  const items = track.children
  if (!items.length) return

  const bounds = track.getBoundingClientRect()
  const center = bounds.left + bounds.width / 2
  const itemWidth = items[0].offsetWidth

  let active = items[0]
  let activeDist = Infinity

  for (const item of items) {
    const rect = item.getBoundingClientRect()
    const dist = Math.abs(rect.left + rect.width / 2 - center)
    const t = Math.min(dist / Math.max(itemWidth, 1), 1)
    item.style.transform = `scale(${1 - t * 0.1})`
    item.style.zIndex = String(Math.max(1, 1000 - Math.round(dist)))
    if (dist < activeDist) {
      activeDist = dist
      active = item
    }
  }

  for (const item of items) {
    item.classList.toggle('is-center', item === active)
  }
}

export function createCards(root, state, { onOpenChange } = {}) {
  const cardsSection = root.querySelector('.cards')
  const iframesSection = root.querySelector('.iframes')
  if (!cardsSection || !iframesSection) return { update() {} }

  const cardTrack = ensureTrack(cardsSection, 'cards-track')
  const iframeTrack = ensureTrack(iframesSection, 'iframes-track')

  let open = false

  // The visible track leads; the hidden one follows at the same scroll ratio,
  // so card N and overlay N are always at the same carousel position.
  const leader = () => (open ? iframeTrack : cardTrack)
  const follower = () => (open ? cardTrack : iframeTrack)

  let frame = 0

  function syncAndScale() {
    frame = 0
    const lead = leader()
    const follow = follower()
    follow.scrollLeft = scrollRatio(lead) * maxScroll(follow)
    scaleItems(cardTrack)
    scaleItems(iframeTrack)
  }

  function requestSync(event) {
    if (event && event.currentTarget !== leader()) return
    if (frame) return
    frame = requestAnimationFrame(syncAndScale)
  }

  cardTrack.addEventListener('scroll', requestSync, { passive: true })
  iframeTrack.addEventListener('scroll', requestSync, { passive: true })
  new ResizeObserver(() => requestSync()).observe(cardTrack)

  function setOpen(next) {
    open = next
    iframesSection.classList.toggle('is-open', open)
    cardsSection.classList.toggle('is-covered', open)
    cardTrack.classList.toggle('is-following', open)
    iframeTrack.classList.toggle('is-following', !open)
    onOpenChange?.(open)
  }

  cardTrack.addEventListener('click', (event) => {
    const card = event.target.closest('.card')
    if (!card) return
    const index = [...cardTrack.children].indexOf(card)
    const overlay = iframeTrack.children[index]
    if (!overlay) return

    cardTrack.scrollLeft = centerOffset(cardTrack, card)
    iframeTrack.scrollLeft = centerOffset(iframeTrack, overlay)
    overlay.querySelector('.iframe-scroll').scrollTop = 0
    setOpen(true)
    syncAndScale()
  })

  iframeTrack.addEventListener('click', (event) => {
    if (!event.target.closest('.iframe-close')) return
    setOpen(false)
    syncAndScale()
  })

  function update(nextState) {
    const ratio = scrollRatio(leader())
    const articles = articlesByBias(visibleArticles(nextState))
    cardTrack.innerHTML = articles.map(cardMarkup).join('')
    iframeTrack.innerHTML = articles.map(overlayMarkup).join('')

    requestAnimationFrame(() => {
      const lead = leader()
      lead.scrollLeft = ratio * maxScroll(lead)
      syncAndScale()
    })
  }

  iframeTrack.classList.add('is-following')
  update(state)

  return {
    update,
    getTrack: leader,
    updateCardScales: syncAndScale,
  }
}
