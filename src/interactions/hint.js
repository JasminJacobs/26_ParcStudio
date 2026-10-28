const SHOW_AFTER_MS = 4000

/** Fade in `.hint` after it stays visible in the scroller for SHOW_AFTER_MS. */
export function createHint(root, scrollRoot) {
  const hint = root.querySelector('.hint')
  if (!hint || !scrollRoot) return

  let timer = null

  function hide() {
    clearTimeout(timer)
    timer = null
    hint.classList.remove('is-visible')
  }

  root.addEventListener('parc:overview-enter', hide)

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (timer != null) return
        timer = setTimeout(() => {
          timer = null
          hint.classList.add('is-visible')
        }, SHOW_AFTER_MS)
        return
      }

      hide()
    },
    { root: scrollRoot, threshold: 0 },
  )

  observer.observe(hint)
}
