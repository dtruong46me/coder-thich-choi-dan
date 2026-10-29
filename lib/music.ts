// Web Audio arpeggiator for the home-page player. Imported only when someone presses play.

export const TRACKS = [
  { name: 'Late-night pop loop', prog: ['C', 'G', 'Am', 'F'] },
  { name: 'Rainy-day arpeggio', prog: ['Am', 'F', 'C', 'G'] },
  { name: 'ii-V-I jazz loop', prog: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'] },
] as const

const NOTES: Record<string, number[]> = {
  C: [48, 55, 60, 64, 67, 64, 60, 55],
  G: [43, 50, 55, 59, 62, 59, 55, 50],
  Am: [45, 52, 57, 60, 64, 60, 57, 52],
  F: [41, 48, 53, 57, 60, 57, 53, 48],
  Dm7: [50, 57, 60, 65, 69, 65, 60, 57],
  G7: [43, 50, 53, 59, 62, 59, 53, 50],
  Cmaj7: [48, 55, 59, 64, 67, 64, 59, 55],
}

export function createLooper(onBar: (bar: number) => void) {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  let timer: ReturnType<typeof setInterval> | null = null
  let step = 0
  let track = 0

  function note(midi: number) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(t)
    o.stop(t + 1.5)
  }

  return {
    start() {
      void ctx.resume()
      step = 0
      if (timer) clearInterval(timer)
      timer = setInterval(() => {
        const bar = Math.floor(step / 8) % 4
        const chord = TRACKS[track]!.prog[bar]!
        note(NOTES[chord]![step % 8]!)
        if (step % 8 === 0) onBar(bar)
        step++
      }, 230)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    setTrack(i: number) {
      track = i
      step = 0
    },
    dispose() {
      if (timer) clearInterval(timer)
      void ctx.close()
    },
  }
}
