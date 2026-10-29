/*
  Shake — a custom `shake` event from the accelerometer (shake.js).
  iOS only delivers motion after a tap, and only on HTTPS or localhost,
  same constraint as the microphone. Call shaker.start() from that tap.

  A finger on the glass is a scroll or a swipe, so those are ignored.
  The desktop preview has no accelerometer: press S.
*/
import Shake from 'shake.js'

export function createShaker({ threshold = 20, timeout = 1100 } = {}) {
  const listeners = {}
  const pointers = new Set()
  let running = false

  function emit(name) {
    ;(listeners[name] || []).forEach((fn) => fn())
  }

  function onShake() {
    if (pointers.size) return
    emit('shake')
  }

  async function start() {
    if (running) return
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      let permission
      try {
        permission = await DeviceMotionEvent.requestPermission()
      } catch {
        return
      }
      if (permission !== 'granted') return
    }

    running = true
    const shake = new Shake({ threshold, timeout })
    shake.start()
    window.addEventListener('shake', onShake)
  }

  window.addEventListener('pointerdown', (event) => pointers.add(event.pointerId))
  window.addEventListener('pointerup', (event) => pointers.delete(event.pointerId))
  window.addEventListener('pointercancel', (event) => pointers.delete(event.pointerId))
  window.addEventListener('blur', () => pointers.clear())

  // Phone frame on a laptop: S stands in for the accelerometer.
  if (matchMedia('(min-width: 600px)').matches) {
    window.addEventListener('keydown', (event) => {
      if (event.key !== 's' && event.key !== 'S') return
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      emit('shake')
    })
  }

  return {
    start,
    on(name, fn) {
      ;(listeners[name] ||= []).push(fn)
    },
  }
}
