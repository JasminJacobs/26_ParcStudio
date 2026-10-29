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

// Tag names (the tag is not shown on the cards at the moment)
const BIAS_LABELS = {
  farleft: 'Far left',
  left: 'Left',
  leanleft: 'Lean left',
  centre: 'Centre',
  leanright: 'Lean right',
  right: 'Right',
  farright: 'Far right',
}

const DEFAULT_IFRAME = 'img/screenshot01.png'

// How fast title / source / bias fade on pinch-out.
// Higher = gone sooner. Opacity hits 0 at progress 1 / TEXT_FADE
// (3 → gone at ~33% of the zoom, 1.7 was the old value).
const TEXT_FADE = 8
const TEXT_IN_MS = 300

// Extra px on top of the logo's measured rest position when shrinking starts.
// 0 keeps it on the pre-`.is-shrinking` spot; +x is right, +y is down.
const LOGO_START_X = 0
const LOGO_START_Y = 0
const LOGO_END = 32

const SOURCE_LOGOS = {
  teleSUR: 'telesur.png',
  'HuffPost It': 'huffpost-it.png',
  'Le Temps': 'le-temps.png',
  'La Stampa': 'la-stampa.png',
  Reuters: 'reuters.png',
  'Le Monde': 'le-monde.png',
  'La Repubblica': 'la-repubblica.png',
  CNN: 'cnn.png',
  Spiegel: 'spiegel.png',
  'franceinfo.fr': 'franceinfo.png',
  'Zeit Online': 'zeit-online.png',
  'Sueddeutsche Zeitung': 'sueddeutsche-zeitung.png',
  'Democracy Now!': 'democracy-now.png',
  Tagesschau: 'tagesschau.png',
  '15min.lt': '15min.png',
  Euronews: 'euronews.png',
  'Radio France Internationale': 'rfi.png',
  'BBC News': 'bbc-news.png',
  'Deutsche Welle': 'deutsche-welle.png',
  Bloomberg: 'bloomberg.png',
  KRDO: 'krdo.png',
  'Neue Zürcher Zeitung': 'nzz.png',
  'FOCUS online': 'focus-online.png',
  Bild: 'bild.png',
  'n-tv': 'n-tv.png',
  Welt: 'welt.png',
  'Frankfurter Allgemeine': 'faz.png',
  'National Post': 'national-post.png',
  RedState: 'redstate.png',
  Breitbart: 'breitbart.png',
  'topwar.ru': 'topwar.png',
}

function publicUrl(path) {
  const base = import.meta.env.BASE_URL
  const file = path.replace(/^\//, '')
  return base.endsWith('/') ? base + file : `${base}/${file}`
}

function logoSrc(article) {
  const file =
    SOURCE_LOGOS[article.source] ?? article.logo?.split('/').pop()
  return file ? publicUrl(`img/logos/${file}`) : ''
}

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

// Card background: white at the top, fading into the source's colour
// (taken from its logo, see data/source-colors.json) by 55% of the height
function cardSurface(source) {
  const color = sourceColors[source] ?? '#6b6b6b'
  const background = `linear-gradient(180deg, #ffffff 0%, ${color} 55%)`
  return { background, color }
}

function cardMarkup(article) {
  const { background, color } = cardSurface(article.source)
  const logo = logoSrc(article)
  return `
    <article
      class="card"
      data-id="${article.id}"
      data-bias="${article.bias}"
      data-type="${article.type ?? ''}"
      data-source="${article.source}"
      style="background: ${background}; --card-color: ${color}"
    >
      <div class="card-tags">
        <img class="card-logo" src="${logo}" alt=""/>
        <div class="card-tags-text">
          <label class="card-source">${article.source}</label>
        </div>
      </div>
      <h2 class="card-title">${article.title}</h2>
    </article>`
}

function overlayMarkup(article) {
  const src = import.meta.env.BASE_URL + (article.iframe ?? DEFAULT_IFRAME)
  return `
    <section class="iframe-overlay" data-id="${article.id}">
      <div class="iframe-scroll">
        <img data-src="${src}" alt="${article.source}" draggable="false" decoding="async" />
      </div>
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

function layerScale(container) {
  return container.getBoundingClientRect().width / Math.max(container.offsetWidth, 1)
}

function rectRelative(el, container) {
  const a = el.getBoundingClientRect()
  const b = container.getBoundingClientRect()
  const scale = layerScale(container)
  return {
    x: (a.left - b.left) / scale,
    y: (a.top - b.top) / scale,
    w: a.width / scale,
    h: a.height / scale,
  }
}

function logoOffset(card, container) {
  const logo = card.querySelector('.card-logo')
  const scale = layerScale(container)
  const cardRect = card.getBoundingClientRect()
  if (!logo) {
    return { left: 16, top: cardRect.height / scale - 56, bottom: 24, size: LOGO_END }
  }
  const logoRect = logo.getBoundingClientRect()
  const left = (logoRect.left - cardRect.left) / scale + LOGO_START_X
  const top = (logoRect.top - cardRect.top) / scale + LOGO_START_Y
  const size = logoRect.height / scale
  const bottom = cardRect.height / scale - top - size
  return { left, top, bottom, size }
}

function resetCardStyle(card) {
  const background = card.style.background
  const cardColor = card.style.getPropertyValue('--card-color')
  card.removeAttribute('style')
  card.style.background = background
  card.style.setProperty('--card-color', cardColor)
  const logo = card.querySelector('.card-logo')
  if (logo) {
    logo.style.width = ''
    logo.style.height = ''
  }
}

// Side cards are this big next to the centre card (Figma: 206.7 / 270)
const CARD_SIDE_SCALE = 0.7656
// Side screenshots in the popup
const IFRAME_SIDE_SCALE = 0.9

// Centre item at full size, its neighbours down to `sideScale`
function scaleItems(track, sideScale) {
  const items = track.children
  if (!items.length) return

  const bounds = track.getBoundingClientRect()
  const center = bounds.left + bounds.width / 2
  // distance between two neighbouring items, centre to centre, in screen px
  // like `dist` below (the mockup is zoomed, so offset values would not match)
  const mid = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2 }
  const pitch = items.length > 1 ? mid(items[1]) - mid(items[0]) : items[0].getBoundingClientRect().width

  let active = items[0]
  let activeDist = Infinity

  for (const item of items) {
    const rect = item.getBoundingClientRect()
    const dist = Math.abs(rect.left + rect.width / 2 - center)
    const t = Math.min(dist / Math.max(pitch, 1), 1)
    item.style.transform = `scale(${1 - t * (1 - sideScale)})`
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
  const iframeOpenTargets = root.querySelectorAll(
    '.meta, .hint, .carousel-counter, .carousel-label, .carousel-slider__thumb, .slider-container, .article__title, .iframe-close',
  )

  // The visible track leads; the hidden one follows at the same scroll ratio,
  // so card N and overlay N are always at the same carousel position.
  const leader = () => (open ? iframeTrack : cardTrack)
  const follower = () => (open ? cardTrack : iframeTrack)

  let frame = 0
  const cta = root.querySelector('.cta')
  let shineBias = ''

  // Paint the CTA ray with the centre article's stance colour (--tag-* in tokens.css).
  function syncCtaShine() {
    if (!cta) return
    const bias = cardTrack.querySelector('.card.is-center')?.dataset.bias
    if (!bias || bias === shineBias || !BIAS_ORDER.includes(bias)) return
    shineBias = bias
    cta.style.setProperty('--cta-shine', `var(--tag-${bias})`)
  }

  // Screenshots stay unloaded until the popup is open, and only the one
  // in the centre plus its two neighbours. Decoding all of them at once
  // is what makes iOS Safari kill the tab ("A problem repeatedly occurred").
  function setShotSources() {
    const items = iframeTrack.children
    let active = 0
    if (open && items.length) {
      const bounds = iframeTrack.getBoundingClientRect()
      const center = bounds.left + bounds.width / 2
      let best = Infinity
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect()
        const dist = Math.abs(rect.left + rect.width / 2 - center)
        if (dist < best) {
          best = dist
          active = i
        }
      }
    }
    for (let i = 0; i < items.length; i++) {
      const img = items[i].querySelector('img')
      if (!img) continue
      const near = open && Math.abs(i - active) <= 1
      if (near) {
        if (img.getAttribute('src') !== img.dataset.src) img.setAttribute('src', img.dataset.src)
      } else if (img.hasAttribute('src')) {
        img.removeAttribute('src')
      }
    }
  }

  function syncAndScale() {
    frame = 0
    const lead = leader()
    const follow = follower()
    follow.scrollLeft = scrollRatio(lead) * maxScroll(follow)
    scaleItems(cardTrack, CARD_SIDE_SCALE)
    scaleItems(iframeTrack, IFRAME_SIDE_SCALE)
    syncCtaShine()
    setShotSources()
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
    iframeOpenTargets.forEach((el) => el.classList.toggle('iframeopen', open))
    setShotSources()
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

  root.querySelector('.iframe-close')?.addEventListener('click', () => {
    if (!open) return
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
      logo: logoOffset(card, layer),
    }))

    const from = new Map()
    layer.classList.add('is-active')

    for (const { card, rect, logo } of measured) {
      from.set(String(card.dataset.id), {
        el: card,
        type: card.dataset.type,
        source: card.dataset.source,
        ...rect,
        logoLeft: logo.left,
        logoBottom: logo.bottom,
        logoSize: logo.size,
      })

      const placeholder = document.createElement('article')
      placeholder.className = 'card is-placeholder'
      placeholder.dataset.id = card.dataset.id
      placeholder.setAttribute('aria-hidden', 'true')
      card.after(placeholder)

      layer.append(card)
      card.style.position = 'absolute'
      card.style.margin = '0'
      card.style.transform = 'none'
      card.style.zIndex = '1'
      card.style.left = `${rect.x}px`
      card.style.top = `${rect.y}px`
      card.style.width = `${rect.w}px`
      card.style.height = `${rect.h}px`
      card.style.setProperty('--logo-left', `${logo.left}px`)
      card.style.setProperty('--logo-top', `${logo.top}px`)
      card.style.setProperty('--title-opacity', '1')
      const logoEl = card.querySelector('.card-logo')
      if (logoEl) {
        logoEl.style.width = `${logo.size}px`
        logoEl.style.height = `${logo.size}px`
      }
      card.classList.add('is-shrinking')
    }

    syncAndScale()
    flight = { from }
    return from
  }

  function applyFlight(from, to, t, inbound = false) {
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
      // Pad to 0: leftover padding on iOS (overflow + radius) becomes the
      // logo's containing block, so it sits off-centre in the chip.
      card.style.padding = `${lerp(16, 0, ease)}px`
      card.style.borderRadius = `${lerp(0, 26, ease)}px`
      // Hold title/source off while flying home; they fade in after endFlight.
      const textOpacity = inbound ? 0 : Math.max(0, 1 - ease * TEXT_FADE)
      card.style.setProperty('--title-opacity', String(textOpacity))
      const logo = lerp(start.logoSize, LOGO_END, ease)
      const left = lerp(start.logoLeft, (w - logo) / 2, ease)
      const top = lerp(h - start.logoBottom - logo, (h - logo) / 2, ease)
      card.style.setProperty('--logo-left', `${left}px`)
      card.style.setProperty('--logo-top', `${top}px`)
      const logoEl = card.querySelector('.card-logo')
      if (logoEl) {
        logoEl.style.width = `${logo}px`
        logoEl.style.height = `${logo}px`
      }
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
    const landed = []
    for (const [id, item] of flight.from) {
      const placeholder = cardTrack.querySelector(
        `.card.is-placeholder[data-id="${id}"]`,
      )
      const card = item.el
      resetCardStyle(card)
      card.classList.remove('is-shrinking', 'is-label')
      card.classList.add('is-text-in')
      card.style.setProperty('--title-opacity', '0')
      landed.push(card)
      if (placeholder) placeholder.replaceWith(card)
      else cardTrack.append(card)
    }
    layer.classList.remove('is-active')
    flight = null
    syncAndScale()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const card of landed) {
          card.style.setProperty('--title-opacity', '1')
        }
      })
    })
    setTimeout(() => {
      for (const card of landed) {
        card.classList.remove('is-text-in')
        card.style.removeProperty('--title-opacity')
      }
    }, TEXT_IN_MS)
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
