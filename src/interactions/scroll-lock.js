/*
  Scroll lock — the article scrolls freely; the gallery locks to the screen.
  When scrolling stops with the gallery only partly visible, the page glides
  either fully onto the gallery or back to the end of the article.
*/
export function createScrollLock(scroller, gallery) {
  let lastTop = scroller.scrollTop
  let direction = 1 // 1: down, -1: up
  let gliding = false
  let timer = 0

  function settle() {
    const galleryTop = gallery.offsetTop - scroller.offsetTop
    const articleEnd = galleryTop - scroller.clientHeight
    const top = scroller.scrollTop
    if (top <= articleEnd + 1 || top >= galleryTop - 1) return // fully in one screen

    // Share of the gallery that is on screen (0–1)
    const visible = (top - articleEnd) / scroller.clientHeight
    const toGallery = direction > 0 ? visible > 0.15 : visible > 0.85
    gliding = true
    scroller.scrollTo({ top: toGallery ? galleryTop : articleEnd, behavior: 'smooth' })
  }

  scroller.addEventListener(
    'scroll',
    () => {
      const top = scroller.scrollTop
      if (!gliding && top !== lastTop) direction = top > lastTop ? 1 : -1
      lastTop = top
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (gliding) gliding = false
        else settle()
      }, 140)
    },
    { passive: true },
  )
}
