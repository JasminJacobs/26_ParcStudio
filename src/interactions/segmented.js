/*
  Button bar with a sliding box (Bias Comparison, map styles in the overview).
  The white / coloured box behind the active button slides to the new one
  on click or on a sideways swipe over the bar. The bar's buttons carry
  data-value; aria-pressed marks the active one.
*/
const SWIPE = 24 // px sideways before a swipe counts

export function createSegmented(bar, { onChange } = {}) {
  const buttons = [...bar.querySelectorAll('[data-value]')]
  let thumb = bar.querySelector('.segmented__thumb')
  if (!thumb) {
    thumb = document.createElement('span')
    thumb.className = 'segmented__thumb'
    thumb.setAttribute('aria-hidden', 'true')
    bar.prepend(thumb)
  }

  let index = Math.max(
    0,
    buttons.findIndex((b) => b.getAttribute('aria-pressed') === 'true'),
  )

  function place(animate) {
    const b = buttons[index]
    if (!b) return
    if (!animate) thumb.style.transition = 'none'
    // Exact size incl. fractions (offset* round, which let the grey face
    // show as a hairline). The phone mockup is scaled with CSS zoom.
    const barRect = bar.getBoundingClientRect()
    const rect = b.getBoundingClientRect()
    const scale = barRect.width / bar.offsetWidth || 1
    const bleed = 0.5 // covers the face's anti-aliased edge
    thumb.style.setProperty('--thumb-width', `${rect.width / scale + bleed * 2}px`)
    thumb.style.setProperty('--thumb-height', `${rect.height / scale + bleed * 2}px`)
    thumb.style.setProperty('--thumb-top', `${(rect.top - barRect.top) / scale - bleed}px`)
    thumb.style.setProperty('--thumb-x', `${(rect.left - barRect.left) / scale - bleed}px`)
    thumb.dataset.value = b.dataset.value
    if (!animate) {
      thumb.getBoundingClientRect() // apply before turning transitions back on
      thumb.style.transition = ''
    }
  }

  function select(next) {
    next = Math.min(buttons.length - 1, Math.max(0, next))
    if (next === index) return
    index = next
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)))
    place(true)
    onChange?.(buttons[index].dataset.value)
  }

  // Click (a click right after a swipe is swallowed by addSwipe)
  buttons.forEach((b, i) => b.addEventListener('click', () => select(i)))

  // Swipe sideways over the bar, like the content below: finger to the
  // left (from the right edge in) → next to the right, and the other way
  addSwipe(bar, (dir) => select(index - dir))

  new ResizeObserver(() => place(false)).observe(bar)
  place(false)

  return {
    select: (value) => select(buttons.findIndex((b) => b.dataset.value === value)),
    refresh: () => place(false),
    // One step left (-1) or right (+1), e.g. from swiping the content below
    step: (dir) => select(index + dir),
  }
}

// Calls onSwipe(+1 / -1) after a sideways swipe over el (+1 = finger moved
// right). Vertical scrolling stays with the page (touch-action: pan-y).
// A click right after a swipe is swallowed, so links don't open by accident.
export function addSwipe(el, onSwipe) {
  let start = null
  let swallow = false
  el.style.touchAction = 'pan-y'
  el.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY }
    swallow = false
  })
  el.addEventListener('pointerup', (event) => {
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    start = null
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy)) return
    swallow = true
    onSwipe(dx > 0 ? 1 : -1)
  })
  el.addEventListener('pointercancel', () => (start = null))
  el.addEventListener(
    'click',
    (event) => {
      if (!swallow) return
      swallow = false
      event.preventDefault()
      event.stopPropagation()
    },
    true,
  )
}
