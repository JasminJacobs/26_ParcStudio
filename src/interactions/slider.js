/*
  Slider — horizontal gallery of articles, left to right.
  Placeholder markup until the Figma frames arrive.
*/
export function createSlider(root, state) {
  const el = document.createElement('section')
  el.className = 'view slider'
  root.append(el)

  function update(state) {
    el.hidden = state.view !== 'slider'
    // el.innerHTML = visibleArticles(state)
    //   .map(
    //     (a) => `
    //     <article class="slide" data-id="${a.id}">
    //       <p>${a.source}</p>
    //       <h2>${a.title}</h2>
    //     </article>`,
    //   )
    //   .join('')
  }

  return { el, update }
}

export function visibleArticles(state) {
  if (state.filter !== 'most-read') return state.articles
  return [...state.articles].sort((a, b) => b.reads - a.reads).slice(0, 5)
}
