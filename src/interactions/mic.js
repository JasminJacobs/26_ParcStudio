/*
  Mic — detects blowing into the microphone via the Web Audio API.
  iOS only allows the mic after a tap and over HTTPS (GitHub Pages is fine).
  Call mic.start() from a tap handler.
*/
export function createMic({ threshold = 0.25, holdMs = 300 } = {}) {
  const listeners = {}
  let running = false

  function emit(name) {
    ;(listeners[name] || []).forEach((fn) => fn())
  }

  async function start() {
    if (running) return
    running = true

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)

    const data = new Float32Array(analyser.fftSize)
    let loudSince = null

    function loop() {
      analyser.getFloatTimeDomainData(data)
      // Loudness (RMS) — blowing produces a strong, sustained signal
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
      const now = performance.now()

      if (rms > threshold) {
        loudSince ??= now
        if (now - loudSince > holdMs) {
          emit('blow')
          loudSince = Infinity // fire once per breath
        }
      } else {
        loudSince = null
      }
      requestAnimationFrame(loop)
    }
    loop()
  }

  return {
    start,
    on(name, fn) {
      ;(listeners[name] ||= []).push(fn)
    },
  }
}
