/*
  Which articles the gallery shows: all, or the five most read
  (the mic "blow" filter, state.filter = 'most-read').
*/
export function visibleArticles(state) {
  if (state.filter !== 'most-read') return state.articles
  return [...state.articles].sort((a, b) => b.reads - a.reads).slice(0, 5)
}
