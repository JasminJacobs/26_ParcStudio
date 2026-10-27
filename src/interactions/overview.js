/*
  Overview — zoomed-out grid / map of all articles.
  Built after the slider; this is the empty shell.
*/
import { visibleArticles } from './slider.js'

export function createOverview(root, state) {
  const el = document.createElement('section')
  el.className = 'view overview'
  root.append(el)

  function update(state) {
    el.hidden = state.view !== 'overview'
    el.innerHTML = visibleArticles(state)
      .map((a) => `<div class="tile" data-id="${a.id}">${a.source}</div>`)
      .join('')
  }

  return { el, update }
}
