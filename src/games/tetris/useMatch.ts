import { useEffect, useRef, useState } from 'react'
import { createGame, drop, interval, move, placements, rotate, sequence, tick, type Game } from '@/games/tetris/rules'
import { decisionResponse, type DecisionResponse } from '@/lib/protocol'

export type Command = 'left' | 'right' | 'rotate' | 'down' | 'drop'
type Match = {
  player: Game; jev: Game; pieces: number[]; elapsed: number
  playerTime: number; jevTime: number; waiting: boolean; paused: boolean
  error: string; tokens: number; calls: number; confidence: number; finished: boolean
}

export function useMatch(round: number) {
  const [view, setView] = useState<Match | null>(null)
  const command = useRef<(action: Command) => void>(() => {})
  const pause = useRef<() => void>(() => {})
  const retry = useRef<() => void>(() => {})

  useEffect(() => {
    if (!round) return
    const pieces = sequence(crypto.getRandomValues(new Uint32Array(1))[0])
    const match: Match = { player: createGame(pieces), jev: createGame(pieces), pieces,
      elapsed: 0, playerTime: 0, jevTime: 0, waiting: false, paused: false,
      error: '', tokens: 0, calls: 0, confidence: 0, finished: false }
    let disposed = false
    let controller: AbortController | null = null
    let decidedIndex = -1
    let fall = 0
    let last = performance.now()
    let painted = 0
    let frame = 0
    const publish = () => { if (!disposed) setView({ ...match }) }
    const runnable = () => !match.waiting && !match.paused && !match.error && !match.finished && !document.hidden
    const updateTimes = () => {
      if (!match.player.over) match.playerTime = match.elapsed
      if (!match.jev.over) match.jevTime = match.elapsed
      match.finished = match.player.over && match.jev.over
    }
    command.current = action => {
      if (!runnable() || match.player.over) return
      if (action === 'left') match.player = move(match.player, -1, 0)
      if (action === 'right') match.player = move(match.player, 1, 0)
      if (action === 'rotate') match.player = rotate(match.player)
      if (action === 'down') match.player = tick(match.player, pieces)
      if (action === 'drop') match.player = drop(match.player, pieces)
      updateTimes()
      publish()
    }
    pause.current = () => { match.paused = !match.paused; publish() }
    retry.current = () => { match.error = ''; publish() }
    const decide = async () => {
      match.waiting = true
      controller = new AbortController()
      const current = controller
      const index = match.jev.index
      const decisionId = `${round}:${index}`
      publish()
      try {
        const response = await fetch('/api/decision', {
          method: 'POST', signal: AbortSignal.any([current.signal, AbortSignal.timeout(17000)]),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: 'tetris', decisionId, board: match.jev.board,
            kind: match.jev.piece.kind, next: pieces.slice(index + 1, index + 4) }),
        })
        if (!response.ok) {
          const message = response.status === 503 ? 'Set TYPESAFE_API_KEY in the server environment and restart the API.' : response.status === 401 ? 'Check TYPESAFE_API_KEY in the server environment.' : response.status === 429 ? 'Rate limit reached. Wait, then retry.' : 'The official API request failed. Retry to continue.'
          throw new Error(message)
        }
        const result: DecisionResponse = decisionResponse.parse(await response.json())
        if (disposed || current.signal.aborted) return
        if (result.decisionId !== decisionId || match.jev.index !== index) throw new Error('Stale decision received')
        const target = placements(match.jev).find(option => option.id === result.action)
        if (!target) throw new Error('Invalid move received')
        match.jev = { ...match.jev, piece: { ...match.jev.piece, rotation: target.rotation, x: target.x } }
        decidedIndex = index
        match.tokens += result.inputTokens
        match.calls++
        match.confidence = result.confidence
      } catch (error) {
        if (!disposed && !current.signal.aborted) match.error = error instanceof Error ? error.message : 'Decision failed'
      } finally {
        if (!disposed) { match.waiting = false; controller = null; last = performance.now(); publish() }
      }
    }
    const animate = (now: number) => {
      const delta = now - last
      last = now
      if (!match.jev.over && decidedIndex !== match.jev.index && !match.waiting && !match.error && !match.paused && !document.hidden) void decide()
      if (runnable()) {
        match.elapsed += delta
        updateTimes()
        fall += delta
        if (fall >= interval(match.elapsed)) {
          fall %= interval(match.elapsed)
          if (!match.player.over) match.player = tick(match.player, pieces)
          if (!match.jev.over) match.jev = tick(match.jev, pieces)
          updateTimes()
        }
      }
      if (now - painted > 50) { publish(); painted = now }
      frame = requestAnimationFrame(animate)
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) || event.target.isContentEditable)) return
      const keys: Record<string, Command> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop' }
      if (keys[event.key]) {
        event.preventDefault()
        if ((event.key === ' ' || event.key === 'ArrowUp') && event.repeat) return
        command.current(keys[event.key])
      }
    }
    const visibility = () => { if (document.hidden) { match.paused = true; publish() } }
    window.addEventListener('keydown', keydown)
    document.addEventListener('visibilitychange', visibility)
    publish()
    frame = requestAnimationFrame(animate)
    return () => {
      disposed = true
      controller?.abort()
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keydown)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [round])
  return { view: round ? view : null, command: (action: Command) => command.current(action), pause: () => pause.current(), retry: () => retry.current() }
}
