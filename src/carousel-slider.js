/*
  Draggable thumb in .slider-container — maps to horizontal scroll on the visible track
  (cards, or the iframe overlays when they are open).
*/
export function createCarouselSlider(root, getTrack) {
  const container = root.querySelector('.slider-container')
  if (!container) return { refresh() {} }

  container.innerHTML = `
    <div class="carousel-slider">
      <div class="carousel-slider__rail">
        <div class="carousel-slider__track-line" aria-hidden="true"></div>
        <div class="carousel-slider__thumb" aria-label="Browse stories"></div>
      </div>
      <div class="carousel-label" id="carousel-label-left">Left</div>
      <div class="carousel-label" id="carousel-label-right">Right</div>
    </div>`

  const rail = container.querySelector('.carousel-slider__rail')
  const thumb = container.querySelector('.carousel-slider__thumb')
  const leftLabel = container.querySelector('#carousel-label-left')
  const rightLabel = container.querySelector('#carousel-label-right')

  let drag = null
  let frame = 0

  function maxScroll() {
    const track = getTrack()
    if (!track) return 0
    return Math.max(0, track.scrollWidth - track.clientWidth)
  }

  function thumbTravel() {
    return Math.max(1, rail.clientWidth - thumb.offsetWidth)
  }

  function setThumbRatio(ratio) {
    const clamped = Math.min(1, Math.max(0, ratio))
    thumb.style.transform = `translate3d(${clamped * thumbTravel()}px, 0, 0)`
  }

  function applyDrag() {
    frame = 0
    if (!drag) return
    const track = getTrack()
    if (!track) return
    const ratio = Math.min(1, Math.max(0, drag.ratio))
    track.scrollLeft = ratio * maxScroll()
    setThumbRatio(ratio)
  }

  function snapToNearestCard() {
    const track = getTrack()
    if (!track) return
    const items = track.children
    if (!items.length) return

    const viewportCenter = track.scrollLeft + track.clientWidth / 2
    let nearest = items[0]
    let nearestDist = Infinity

    for (const item of items) {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2
      const dist = Math.abs(itemCenter - viewportCenter)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = item
      }
    }

    const target =
      nearest.offsetLeft - (track.clientWidth - nearest.offsetWidth) / 2
    track.scrollTo({ left: target, behavior: 'smooth' })
  }

  function syncFromTrack() {
    if (drag) return
    const track = getTrack()
    const max = maxScroll()
    setThumbRatio(max === 0 || !track ? 0 : track.scrollLeft / max)
  }

  thumb.addEventListener('pointerdown', (event) => {
    const track = getTrack()
    if (!track) return
    event.preventDefault()
    const max = maxScroll()
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startRatio: max === 0 ? 0 : track.scrollLeft / max,
      ratio: max === 0 ? 0 : track.scrollLeft / max,
    }
    thumb.classList.add('is-dragging')
    track.classList.add('is-scrubbing')
    thumb.setPointerCapture(event.pointerId)
  })

  thumb.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    drag.ratio = drag.startRatio + (event.clientX - drag.startX) / thumbTravel()
    if (!frame) frame = requestAnimationFrame(applyDrag)
  })

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return
    cancelAnimationFrame(frame)
    applyDrag()
    drag = null
    thumb.classList.remove('is-dragging')
    getTrack()?.classList.remove('is-scrubbing')
    snapToNearestCard()
  }

  thumb.addEventListener('pointerup', endDrag)
  thumb.addEventListener('pointercancel', endDrag)

  let trackBound = null
  const resizeObserver = new ResizeObserver(() => syncFromTrack())

  function bindTrack() {
    const track = getTrack()
    if (!track || track === trackBound) return
    if (trackBound) {
      trackBound.removeEventListener('scroll', syncFromTrack)
      resizeObserver.disconnect()
    }
    trackBound = track
    track.addEventListener('scroll', syncFromTrack, { passive: true })
    resizeObserver.observe(track)
  }

  function refresh() {
    bindTrack()
    syncFromTrack()
  }

  return { refresh }
}
