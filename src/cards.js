import { visibleArticles } from './interactions/slider.js'
import sourceColors from './data/source-colors.json'

export const BIAS_ORDER = [
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
      data-type="${article.type ?? ''}"
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

function lerp(a, b, t) {
  return a + (b - a) * t
}

function rectRelative(el, container) {
  const a = el.getBoundingClientRect()
  const b = container.getBoundingClientRect()
  const scale = b.width / Math.max(container.offsetWidth, 1)
  return {
    x: (a.left - b.left) / scale,
    y: (a.top - b.top) / scale,
    w: a.width / scale,
    h: a.height / scale,
  }
}

function resetCardStyle(card) {
  const background = card.style.background
  const color = card.style.color
  card.removeAttribute('style')
  card.style.background = background
  card.style.color = color
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

  let layer = root.querySelector('.cards-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'cards-layer'
    root.append(layer)
  }

  let open = false
  let flight = null

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

  let currentArticles = []

  function beginFlight() {
    if (flight) return flight.from

    const cards = [...cardTrack.querySelectorAll('.card:not(.is-placeholder)')]
    const measured = cards.map((card) => ({
      card,
      rect: rectRelative(card, layer),
    }))

    const from = new Map()
    layer.classList.add('is-active')

    for (const { card, rect } of measured) {
      from.set(String(card.dataset.id), {
        el: card,
        type: card.dataset.type,
        source: card.dataset.source,
        ...rect,
      })

      const placeholder = document.createElement('article')
      placeholder.className = 'card is-placeholder'
      placeholder.dataset.id = card.dataset.id
      placeholder.setAttribute('aria-hidden', 'true')
      card.after(placeholder)

      layer.append(card)
      card.classList.add('is-shrinking')
      card.style.position = 'absolute'
      card.style.margin = '0'
      card.style.transform = 'none'
      card.style.zIndex = '1'
      card.style.left = `${rect.x}px`
      card.style.top = `${rect.y}px`
      card.style.width = `${rect.w}px`
      card.style.height = `${rect.h}px`
    }

    syncAndScale()
    flight = { from }
    return from
  }

  function applyFlight(from, to, t) {
    for (const [id, start] of from) {
      const end = to.get(id)
      if (!end) continue
      const card = start.el
      const ease = t
      const cx = lerp(start.x + start.w / 2, end.x + end.w / 2, ease)
      const cy = lerp(start.y + start.h / 2, end.y + end.h / 2, ease)
      const w = lerp(start.w, end.w, ease)
      const h = lerp(start.h, end.h, ease)
      card.style.left = `${cx - w / 2}px`
      card.style.top = `${cy - h / 2}px`
      card.style.width = `${w}px`
      card.style.height = `${h}px`
      card.style.padding = `${lerp(16, 6, ease)}px ${lerp(16, 10, ease)}px`
      card.style.borderRadius = `${lerp(0, 18, ease)}px`
      card.style.setProperty('--title-opacity', String(Math.max(0, 1 - ease * 1.7)))
      card.classList.toggle('is-label', ease > 0.52)
    }
  }

  function measureHomes() {
    const homes = new Map()
    if (!flight) return homes
    for (const [id, item] of flight.from) {
      const placeholder = cardTrack.querySelector(
        `.card.is-placeholder[data-id="${id}"]`,
      )
      if (!placeholder) continue
      homes.set(id, { el: item.el, ...rectRelative(placeholder, layer) })
    }
    return homes
  }

  function centerById(id) {
    const item = [...cardTrack.children].find(
      (el) => el.dataset.id === String(id),
    )
    if (!item) return
    cardTrack.scrollLeft = centerOffset(cardTrack, item)
    const overlay = [...iframeTrack.children].find(
      (el) => el.dataset.id === String(id),
    )
    if (overlay) iframeTrack.scrollLeft = centerOffset(iframeTrack, overlay)
    syncAndScale()
  }

  function endFlight() {
    if (!flight) return
    for (const [id, item] of flight.from) {
      const placeholder = cardTrack.querySelector(
        `.card.is-placeholder[data-id="${id}"]`,
      )
      const card = item.el
      resetCardStyle(card)
      card.classList.remove('is-shrinking', 'is-label')
      if (placeholder) placeholder.replaceWith(card)
      else cardTrack.append(card)
    }
    layer.classList.remove('is-active')
    flight = null
    syncAndScale()
  }

  function update(nextState) {
    if (flight) return
    const ratio = scrollRatio(leader())
    const articles = articlesByBias(visibleArticles(nextState))
    currentArticles = articles
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
    getArticles: () => currentArticles,
    updateCardScales: syncAndScale,
    getLayer: () => layer,
    isOpen: () => open,
    setOpen,
    beginFlight,
    applyFlight,
    measureHomes,
    centerById,
    endFlight,
  }
}
