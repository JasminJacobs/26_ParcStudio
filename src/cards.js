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
  const src = import.meta.env.BASE_URL + (article.iframe ?? DEFAULT_IFRAME)
  return `
    <article
      class="card"
      data-id="${article.id}"
      data-bias="${article.bias}"
      data-type="${article.type ?? ''}"
      data-source="${article.source}"
      style="background: ${background}; --card-color: ${color}"
    >
      <div class="iframe-scroll">
        <img data-src="${src}" alt="" draggable="false" decoding="async" />
      </div>
      <div class="iframe-scrollbar" aria-hidden="true"${article.scrollbar ? ` data-scale="${article.scrollbar}"` : ''}><div class="iframe-scrollbar__thumb"></div></div>
      <div class="card-face">
        <div class="card-tags">
          <img class="card-logo" src="${logo}" alt=""/>
          <div class="card-tags-text">
            <label class="card-source">${article.source}</label>
          </div>
        </div>
        <h2 class="card-title">${article.title}</h2>
      </div>
    </article>`
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

function cssZoom(el) {
  const zoom = el.getBoundingClientRect().width / Math.max(el.offsetWidth, 1)
  return zoom || 1
}

function readScale(el) {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 1
  return new DOMMatrix(t).a || 1
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
// Side screenshots once a card has grown into the article
const IFRAME_SIDE_SCALE = 0.9
// Card growing into the article. Matches the title's scale-down.
const GROW_MS = 600

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
  if (!cardsSection) return { update() {} }

  const gallery = cardsSection.closest('.gallery') || cardsSection.parentElement
  const cardTrack = ensureTrack(cardsSection, 'cards-track')

  let layer = root.querySelector('.cards-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'cards-layer'
    root.append(layer)
  }

  let open = false
  let flight = null
  let animating = false
  let growToken = 0
  let pinnedScroll = 0
  const iframeOpenTargets = root.querySelectorAll(
    '.meta, .hint, .carousel-counter, .carousel-label, .carousel-slider__thumb, .slider-container, .article__title, .iframe-close',
  )

  let frame = 0
  const cta = root.querySelector('.cta')
  const subscribe = root.querySelector('.subscribe')
  let shineBias = ''

  // Paint the CTA ray with the centre article's stance colour (--tag-* in tokens.css).
  function syncCtaShine() {
    if (!cta) return
    const bias = cardTrack.querySelector('.card.is-center')?.dataset.bias
    if (!bias || bias === shineBias || !BIAS_ORDER.includes(bias)) return
    shineBias = bias
    cta.style.setProperty('--cta-shine', `var(--tag-${bias})`)
  }

  // Subscribe: the word uses the button's shine, then the button stays gone.
  function openSubscribe() {
    if (!subscribe || !subscribe.hidden) return
    const shine = cta.style.getPropertyValue('--cta-shine') || 'var(--tag-centre)'
    subscribe.style.setProperty('--cta-shine', shine)
    cta.parentElement?.classList.add('is-subscribed')
    subscribe.hidden = false
    subscribe.classList.remove('is-open')
    void subscribe.offsetWidth // commit opacity 0 so the fade-in can run
    subscribe.classList.add('is-open')
  }

  function closeSubscribe() {
    if (!subscribe || subscribe.hidden || !subscribe.classList.contains('is-open')) return
    subscribe.classList.remove('is-open')
    const finish = (event) => {
      if (event && (event.target !== subscribe || event.propertyName !== 'opacity')) return
      subscribe.hidden = true
      subscribe.removeEventListener('transitionend', finish)
    }
    subscribe.addEventListener('transitionend', finish)
    setTimeout(finish, 400)
  }

  cta?.addEventListener('click', openSubscribe)
  subscribe?.querySelector('.subscribe__close')?.addEventListener('click', closeSubscribe)

  // Screenshots stay unloaded until the popup is open, and only the one
  // in the centre plus its two neighbours. Decoding all of them at once
  // is what makes iOS Safari kill the tab ("A problem repeatedly occurred").
  // An image with no src is display:none, so a shot that is fading out has
  // to keep its src or the picture pops away instead of fading.
  function shotHeld(img) {
    if (animating) return true
    const shot = img.closest('.iframe-scroll')
    return !!shot && shot.getAnimations().some((anim) => anim.playState !== 'finished')
  }

  function setShotSources() {
    const items = [...cardTrack.children].filter(
      (el) => !el.classList.contains('is-placeholder'),
    )
    let active = 0
    if (open && items.length) {
      const bounds = cardTrack.getBoundingClientRect()
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
      const img = items[i].querySelector('.iframe-scroll img')
      if (!img) continue
      const near = open && Math.abs(i - active) <= 1
      if (near) {
        if (img.getAttribute('src') !== img.dataset.src) img.setAttribute('src', img.dataset.src)
      } else if (img.hasAttribute('src') && !shotHeld(img)) {
        img.removeAttribute('src')
      }
    }
  }

  function syncAndScale() {
    frame = 0
    if (animating) return
    scaleItems(cardTrack, open ? IFRAME_SIDE_SCALE : CARD_SIDE_SCALE)
    syncCtaShine()
    setShotSources()
  }

  function requestSync(event) {
    if (animating) return
    if (event && event.currentTarget !== cardTrack) return
    if (frame) return
    frame = requestAnimationFrame(syncAndScale)
  }

  cardTrack.addEventListener('scroll', requestSync, { passive: true })

  // Swipe through the open iframes with the mouse (touch and trackpad
  // scroll the strip natively): drag sideways → next / previous article
  let drag = null
  let dragged = false
  cardTrack.addEventListener('pointerdown', (event) => {
    dragged = false
    drag = open && event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null
  })
  cardTrack.addEventListener('pointerup', (event) => {
    if (!drag || !open) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    dragged = true
    const items = [...cardTrack.children].filter((el) => !el.classList.contains('is-placeholder'))
    const current = items.findIndex((el) => el.classList.contains('is-center'))
    const next = items[Math.min(items.length - 1, Math.max(0, current + (dx < 0 ? 1 : -1)))]
    if (next) cardTrack.scrollTo({ left: centerOffset(cardTrack, next), behavior: 'smooth' })
  })
  // a drag isn't a click
  cardTrack.addEventListener(
    'click',
    (event) => {
      if (!dragged) return
      dragged = false
      event.stopPropagation()
      event.preventDefault()
    },
    true,
  )

  // Grey scrollbar on the right of the iframe (the native one is hidden):
  // thumb height = visible share of the screenshot, position = scroll
  function updateScrollbar(shot) {
    const bar = shot.parentElement?.querySelector('.iframe-scrollbar')
    if (!bar) return
    const max = shot.scrollHeight - shot.clientHeight
    bar.classList.toggle('is-empty', max <= 1)
    if (max <= 1) return
    const track = bar.clientHeight
    // Thumb length: a quarter of the visible share, or the article's own
    // "scrollbar" value from articles.json (1 = full share)
    const THUMB_SCALE = Number(bar.dataset.scale) || 0.25
    const h = Math.max(8, (THUMB_SCALE * track * shot.clientHeight) / shot.scrollHeight)
    bar.style.setProperty('--thumb-h', `${h}px`)
    bar.style.setProperty('--thumb-y', `${((track - h) * shot.scrollTop) / max}px`)
  }
  function updateScrollbars() {
    cardTrack.querySelectorAll('.iframe-scroll').forEach(updateScrollbar)
  }
  // scroll and load don't bubble, so listen in the capture phase
  cardTrack.addEventListener(
    'scroll',
    (event) => {
      if (event.target.classList?.contains('iframe-scroll')) updateScrollbar(event.target)
    },
    { capture: true, passive: true },
  )
  cardTrack.addEventListener(
    'load',
    (event) => {
      const shot = event.target.closest?.('.iframe-scroll')
      if (shot) updateScrollbar(shot)
    },
    true,
  )
  new ResizeObserver(() => requestSync()).observe(cardTrack)

  function chrome() {
    iframeOpenTargets.forEach((el) => el.classList.toggle('iframeopen', open))
    requestAnimationFrame(updateScrollbars)
    onOpenChange?.(open)
  }

  // Open: the strip lives on #app, in the same box the popup used to fill.
  // Closed: it sits back in the gallery. Cards already on the map layer are
  // left alone; only the strip (and its placeholders) changes size.
  function layoutExpanded(next) {
    const centeredId = cardTrack.querySelector('.card.is-center')?.dataset.id
    open = next
    cardsSection.classList.toggle('is-expanded', open)
    if (open) {
      if (cardsSection.parentElement !== root) root.append(cardsSection)
    } else if (gallery && cardsSection.parentElement !== gallery) {
      gallery.insertBefore(cardsSection, gallery.firstChild)
    }
    for (const card of cardTrack.querySelectorAll('.card:not(.is-placeholder)')) {
      card.classList.toggle('is-expanded', open)
    }
    // Reparenting drops scrollLeft, which would otherwise land on the first card.
    const centered = centeredId
      ? [...cardTrack.children].find((el) => el.dataset.id === centeredId)
      : null
    if (centered) cardTrack.scrollLeft = centerOffset(cardTrack, centered)
    chrome()
    setShotSources()
  }

  function clearFades(scope) {
    scope
      .querySelectorAll('.card-title, .card-tags-text, .card-logo, .iframe-scroll')
      .forEach((el) => el.getAnimations().forEach((anim) => anim.cancel()))
  }

  // Opacity through a custom property does not transition, so the crossfade
  // is its own animation. Cancelling it hands the final value back to CSS.
  function fadePiece(el, from, to, duration, delay) {
    if (!el) return
    el.getAnimations().forEach((anim) => anim.cancel())
    if (Math.abs(Number(from) - to) < 0.01) return
    const anim = el.animate([{ opacity: Number(from) }, { opacity: to }], {
      duration,
      delay,
      easing: 'ease-in-out',
      fill: 'both',
    })
    anim.finished
      .then(() => {
        anim.cancel()
        if (el.classList.contains('iframe-scroll') && !open) setShotSources()
      })
      .catch(() => {})
  }

  function fadeSnap(cards) {
    return cards.map((card) => ({
      title: getComputedStyle(card.querySelector('.card-title')).opacity,
      tags: getComputedStyle(card.querySelector('.card-tags-text')).opacity,
      logo: getComputedStyle(card.querySelector('.card-logo')).opacity,
      shot: getComputedStyle(card.querySelector('.iframe-scroll')).opacity,
    }))
  }

  function fadeCards(cards, opening, snaps) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const textDur = reduce ? 1 : opening ? 250 : 250
    const textDelay = reduce ? 0 : opening ? 0 : 280
    const shotDur = reduce ? 1 : opening ? 320 : 280
    const shotDelay = reduce ? 0 : opening ? 200 : 0
    cards.forEach((card, i) => {
      const snap = snaps[i]
      fadePiece(card.querySelector('.card-title'), snap.title, opening ? 0 : 1, textDur, textDelay)
      fadePiece(card.querySelector('.card-tags-text'), snap.tags, opening ? 0 : 1, textDur, textDelay)
      fadePiece(card.querySelector('.card-logo'), snap.logo, opening ? 0 : 1, textDur, textDelay)
      fadePiece(card.querySelector('.iframe-scroll'), snap.shot, opening ? 1 : 0, shotDur, shotDelay)
    })
  }

  function settleGrow() {
    if (!animating) return
    animating = false
    growToken += 1
    root.classList.remove('is-flipping')
    cardTrack.classList.remove('is-scrubbing')
    cardTrack.scrollLeft = pinnedScroll
    // The crossfade runs longer than the size change. Leave it; each fade
    // cancels itself when it finishes and the CSS variables take over.
    for (const card of cardTrack.querySelectorAll('.card')) {
      card.style.transition = 'none'
      card.style.transform = ''
      card.style.transformOrigin = ''
      unpinTitle(card)
    }
    syncAndScale()
  }

  // Where the headline sits in the card, in layout px, before the grow.
  function captureTitle(card) {
    const title = card.querySelector('.card-title')
    if (!title) return null
    const zoom = cssZoom(root)
    const scale = readScale(card) || 1
    const cardRect = card.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()
    return {
      title,
      left: (titleRect.left - cardRect.left) / zoom / scale,
      top: (titleRect.top - cardRect.top) / zoom / scale,
      width: title.offsetWidth,
      height: title.offsetHeight,
    }
  }

  // Draw the headline at its old size and line breaks, scaled so the card's
  // own transform cancels it. It then grows with the card instead of reflowing.
  function pinTitle(card, lock, rest, sx, sy) {
    if (!lock) return
    const cx = 1 / Math.max(rest * sx, 0.001)
    const cy = 1 / Math.max(rest * sy, 0.001)
    card.classList.add('is-title-pinned')
    const { title } = lock
    title.style.position = 'absolute'
    title.style.left = `${lock.left * cx}px`
    title.style.top = `${lock.top * cy}px`
    title.style.width = `${lock.width}px`
    title.style.height = `${lock.height}px`
    title.style.transformOrigin = '0 0'
    title.style.transform = `scale(${cx}, ${cy})`
  }

  function unpinTitle(card) {
    card.classList.remove('is-title-pinned')
    const title = card.querySelector('.card-title')
    if (!title) return
    title.style.position = ''
    title.style.left = ''
    title.style.top = ''
    title.style.width = ''
    title.style.height = ''
    title.style.transformOrigin = ''
    title.style.transform = ''
  }

  // Grow or shrink every card together. The layout jumps to the destination
  // and a transform plays the move backwards, so the centre card stays put
  // in the carousel while it changes size.
  function runFlip(next, presetFirst, activeId) {
    const cards = [...cardTrack.querySelectorAll('.card:not(.is-placeholder)')]
    if (!cards.length) {
      layoutExpanded(next)
      syncAndScale()
      return
    }

    animating = true
    const active =
      cards.find((el) => el.dataset.id === String(activeId)) ||
      cards.find((el) => el.classList.contains('is-center')) ||
      cards[0]
    const id = active.dataset.id
    cards.forEach(unpinTitle)
    const titleLocks = next ? cards.map(captureTitle) : []
    const first = presetFirst || cards.map((el) => el.getBoundingClientRect())
    const fades = fadeSnap(cards)

    root.classList.add('is-flipping')
    cardTrack.classList.add('is-scrubbing')
    layoutExpanded(next)
    fadeCards(cards, next, fades)

    const item = [...cardTrack.children].find((el) => el.dataset.id === String(id))
    if (item) {
      if (next) {
        const shot = item.querySelector('.iframe-scroll')
        if (shot) shot.scrollTop = 0
      }
      cardTrack.scrollLeft = centerOffset(cardTrack, item)
      pinnedScroll = cardTrack.scrollLeft
    }
    scaleItems(cardTrack, next ? IFRAME_SIDE_SCALE : CARD_SIDE_SCALE)
    setShotSources()

    const zoom = cssZoom(root)
    const last = cards.map((el) => el.getBoundingClientRect())
    const rests = cards.map(readScale)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const ms = reduce ? 1 : GROW_MS

    cards.forEach((card, i) => {
      const rest = rests[i]
      const sx = first[i].width / Math.max(last[i].width, 1)
      const sy = first[i].height / Math.max(last[i].height, 1)
      const dx = (first[i].left + first[i].width / 2 - (last[i].left + last[i].width / 2)) / zoom
      const dy = (first[i].top + first[i].height / 2 - (last[i].top + last[i].height / 2)) / zoom
      card.style.transformOrigin = 'center center'
      card.style.transition = 'none'
      // Same function list at both ends, or the browser snaps instead of moving.
      card.style.transform = `translate(${dx}px, ${dy}px) scale(${rest * sx}, ${rest * sy})`
      if (next) pinTitle(card, titleLocks[i], rest, sx, sy)
    })

    if (frame) cancelAnimationFrame(frame)
    frame = 0
    // Commit the inverted position, then transition to the resting scale.
    // A second frame is unreliable when the tab is in the background.
    cards[0].offsetWidth
    const token = ++growToken
    cards.forEach((card, i) => {
      card.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`
      card.style.transform = `translate(0px, 0px) scale(${rests[i]}, ${rests[i]})`
    })
    window.setTimeout(() => {
      if (token !== growToken) return
      settleGrow()
    }, ms + 50)
  }

  function flipTo(next, activeId) {
    next = !!next
    if (flight) return
    const cards = [...cardTrack.querySelectorAll('.card:not(.is-placeholder)')]
    let preset = null
    if (animating) {
      preset = cards.map((el) => el.getBoundingClientRect())
      animating = false
      growToken += 1
      root.classList.remove('is-flipping')
      for (const card of cards) {
        card.style.transition = 'none'
        card.style.transform = ''
        card.style.transformOrigin = ''
      }
    } else if (next === open) {
      return
    }
    runFlip(next, preset, activeId)
  }

  function setOpen(next) {
    next = !!next
    if (flight) {
      layoutExpanded(next)
      return
    }
    if (next === open && !animating) return
    flipTo(next)
  }

  function openCard(id) {
    if (open || animating || flight) return
    flipTo(true, id)
  }

  cardTrack.addEventListener('click', (event) => {
    const card = event.target.closest('.card')
    if (!card || card.classList.contains('is-placeholder')) return
    openCard(card.dataset.id)
  })

  root.querySelector('.iframe-close')?.addEventListener('click', () => {
    if (!open && !animating) return
    flipTo(false)
  })

  let currentArticles = []

  function beginFlight() {
    if (flight) return flight.from
    if (animating) settleGrow()
    clearFades(cardTrack)

    const cards = [...cardTrack.querySelectorAll('.card:not(.is-placeholder)')]
    const measured = cards.map((card) => ({
      card,
      rect: rectRelative(card, layer),
      logo: logoOffset(card, layer),
    }))

    const from = new Map()
    layer.classList.add('is-active')

    for (const { card, rect, logo } of measured) {
      const expanded = card.classList.contains('is-expanded')
      from.set(String(card.dataset.id), {
        el: card,
        type: card.dataset.type,
        source: card.dataset.source,
        ...rect,
        logoLeft: logo.left,
        logoBottom: logo.bottom,
        logoSize: logo.size,
        expanded,
        pad: expanded ? 0 : 16,
        radius: expanded ? 2 : 0,
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
      card.style.setProperty('--title-opacity', expanded ? '0' : '1')
      if (expanded) {
        card.style.padding = '0px'
        card.style.borderRadius = '2px'
        card.style.setProperty('--shot-opacity', '1')
        card.style.setProperty('--logo-opacity', '0')
        card.classList.remove('is-expanded')
      }
      const logoEl = card.querySelector('.card-logo')
      if (logoEl) {
        logoEl.style.width = `${logo.size}px`
        logoEl.style.height = `${logo.size}px`
      }
      card.classList.add('is-shrinking')
    }

    cardsSection.classList.add('is-flying')
    syncAndScale()
    flight = {
      from,
      centeredId: cardTrack.querySelector('.card.is-center')?.dataset.id,
    }
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
      card.style.padding = `${lerp(start.pad ?? 16, 0, ease)}px`
      card.style.borderRadius = `${lerp(start.radius ?? 0, 26, ease)}px`
      if (start.expanded) {
        // The article image shrinks away and the logo takes its place.
        card.style.setProperty('--shot-opacity', String(1 - ease))
        card.style.setProperty('--logo-opacity', String(ease))
        card.style.setProperty('--title-opacity', '0')
      } else {
        // Hold title/source off while flying home; they fade in after endFlight.
        const textOpacity = inbound ? 0 : Math.max(0, 1 - ease * TEXT_FADE)
        card.style.setProperty('--title-opacity', String(textOpacity))
      }
      // Place the logo in the layer, on a straight line from where it sits on
      // the card to the centre of the circle. Doing it inside the card sends
      // it up out of the shrinking box, then back down.
      const logo = lerp(start.logoSize, LOGO_END, ease)
      const startTop = start.h - start.logoBottom - start.logoSize
      const logoCx = lerp(
        start.x + start.logoLeft + start.logoSize / 2,
        end.x + end.w / 2,
        ease,
      )
      const logoCy = lerp(
        start.y + startTop + start.logoSize / 2,
        end.y + end.h / 2,
        ease,
      )
      const left = logoCx - logo / 2 - (cx - w / 2)
      const top = logoCy - logo / 2 - (cy - h / 2)
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
    // During a flight, land on this card too (endFlight re-centres on it)
    if (flight) flight.centeredId = String(id)
    syncAndScale()
  }

  // After the map is committed, the way home is the small card, not the
  // grown article. Keep each card element and retarget its start rect.
  function retargetToHomes(homes, { closed = false } = {}) {
    if (!flight) return
    for (const [id, start] of flight.from) {
      const home = homes.get(id)
      if (!home) continue
      const nextH = home.h || start.h || 1
      if (closed || start.expanded) {
        const logo = nextH * 0.107
        start.logoSize = logo
        start.logoLeft = nextH * 0.04
        start.logoBottom = nextH - nextH * 0.0315 - logo
        start.expanded = false
        start.pad = 16
        start.radius = 0
        start.el.style.setProperty('--shot-opacity', '0')
        start.el.style.removeProperty('--logo-opacity')
      } else if (start.h) {
        const k = nextH / start.h
        start.logoSize *= k
        start.logoLeft *= k
        start.logoBottom *= k
      }
      start.x = home.x
      start.y = home.y
      start.w = home.w
      start.h = home.h
    }
  }

  function endFlight() {
    if (!flight) return
    const reopen = open
    const centeredId = flight.centeredId || cardTrack.querySelector('.card.is-center')?.dataset.id
    const landed = []
    cardsSection.classList.remove('is-flying')
    for (const [id, item] of flight.from) {
      const placeholder = cardTrack.querySelector(
        `.card.is-placeholder[data-id="${id}"]`,
      )
      const card = item.el
      resetCardStyle(card)
      card.classList.remove('is-shrinking', 'is-label', 'is-text-in')
      card.classList.toggle('is-expanded', reopen)
      if (placeholder) placeholder.replaceWith(card)
      else cardTrack.append(card)
      if (!reopen) {
        card.classList.add('is-text-in')
        card.style.setProperty('--title-opacity', '0')
        landed.push(card)
      }
    }
    layer.classList.remove('is-active')
    flight = null
    const center = centeredId
      ? cardTrack.querySelector(`.card[data-id="${centeredId}"]`)
      : cardTrack.querySelector('.card:not(.is-placeholder)')
    if (center) cardTrack.scrollLeft = centerOffset(cardTrack, center)
    syncAndScale()
    if (reopen) return
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
    if (flight || animating) return
    const ratio = scrollRatio(cardTrack)
    const articles = articlesByBias(visibleArticles(nextState))
    currentArticles = articles
    cardTrack.innerHTML = articles.map(cardMarkup).join('')
    if (open) {
      for (const card of cardTrack.querySelectorAll('.card')) {
        card.classList.add('is-expanded')
      }
    }

    requestAnimationFrame(() => {
      cardTrack.scrollLeft = ratio * maxScroll(cardTrack)
      syncAndScale()
    })
  }

  update(state)

  return {
    update,
    getTrack: () => cardTrack,
    getArticles: () => currentArticles,
    updateCardScales: syncAndScale,
    getLayer: () => layer,
    isOpen: () => open,
    open: openCard,
    // Close the open card (same as the X): back to the gallery, same card centred
    close: () => {
      if (open && !flight) flipTo(false)
    },
    setOpen,
    beginFlight,
    applyFlight,
    measureHomes,
    retargetToHomes,
    centerById,
    endFlight,
  }
}
