const SHOW_AFTER_MS = 8000

/** Fade in `.hint` after it stays visible in the scroller for 8s. */
export function createHint(root, scrollRoot) {
  const hint = root.querySelector('.hint')
  if (!hint || !scrollRoot) return

  let timer = null

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

      clearTimeout(timer)
      timer = null
      hint.classList.remove('is-visible')
    },
    { root: scrollRoot, threshold: 0 },
  )

  observer.observe(hint)
}
