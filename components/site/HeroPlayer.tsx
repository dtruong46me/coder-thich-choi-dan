'use client'
import { useEffect, useRef, useState } from 'react'
import { DotGlobe } from '@/components/ds/DotGlobe'
import { PlayerBar } from '@/components/ds/PlayerBar'
import { TRACKS } from '@/lib/music'
import { useRegisterCommands } from './CommandLine'

type Looper = ReturnType<typeof import('@/lib/music').createLooper>

/** The dancing globe and chord-loop player. Web Audio starts only after someone presses play. */
export function HeroPlayer({ size = 420, simple = false }: { size?: number; simple?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [track, setTrack] = useState(0)
  const [bar, setBar] = useState(0)
  const looper = useRef<Looper | null>(null)

  useEffect(() => () => looper.current?.dispose(), [])

  async function toggle() {
    if (simple) return setPlaying((p) => !p)
    if (playing) {
      looper.current?.stop()
      return setPlaying(false)
    }
    if (!looper.current) {
      const { createLooper } = await import('@/lib/music')
      looper.current = createLooper(setBar)
      looper.current.setTrack(track)
    }
    looper.current.start()
    setBar(0)
    setPlaying(true)
  }

  function next() {
    const i = (track + 1) % TRACKS.length
    setTrack(i)
    setBar(0)
    looper.current?.setTrack(i)
  }

  useRegisterCommands([{ cmd: 'play', desc: 'Play or pause the music loop', run: () => void toggle() }])

  const tr = TRACKS[track]!
  return (
    <div className="hero-player">
      <DotGlobe size={size} playing={playing} />
      <PlayerBar
        title={tr.name}
        chords={[...tr.prog]}
        active={bar}
        playing={playing}
        status={playing ? (simple ? 'SPINNING' : 'NOW PLAYING') : 'PRESS PLAY'}
        onToggle={() => void toggle()}
        onNext={simple ? undefined : next}
      />
    </div>
  )
}
