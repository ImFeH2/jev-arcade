import { useState } from 'react'
import { Button, Theme } from '@radix-ui/themes'
import { HEIGHT, SHAPES, WIDTH, createGame, landing, shape, type Game } from '@/games/tetris/rules'
import { useMatch, type Command } from '@/games/tetris/useMatch'
import '@/styles/App.css'

const COLORS = ['transparent', '#61d7e8', '#e9d372', '#b5a2ed', '#a4cd83', '#eb8c88', '#8caaf0', '#dfac78']
const EMPTY = createGame([0])
const time = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`

function Board({ game, label, duration, next }: { game: Game; label: string; duration: number; next: number[] }) {
  const cells = game.board.map(row => [...row])
  const ghost = new Set<number>()
  if (!game.over) {
    const final = landing(game)
    shape(final).forEach((row, y) => row.forEach((cell, x) => { if (cell) ghost.add((final.y + y) * WIDTH + final.x + x) }))
    shape(game.piece).forEach((row, y) => row.forEach((cell, x) => { if (cell) cells[game.piece.y + y][game.piece.x + x] = game.piece.kind + 1 }))
  }
  return <section className="station" aria-label={`${label} board`}>
    <header className="station-header"><h2>{label}</h2><span className={game.over ? 'status out' : 'status'}>{game.over ? 'OUT' : 'READY'}</span></header>
    <div className="board-frame">
      <svg className="board" viewBox={`0 0 ${WIDTH * 24} ${HEIGHT * 24}`} role="img" aria-label={`${label}: ${time(duration)} survived, ${game.lines} lines cleared${game.over ? ', game over' : ''}`}>
        {cells.flatMap((row, y) => row.map((cell, x) => <rect key={`${x}:${y}`} x={x * 24 + 1} y={y * 24 + 1} width="22" height="22" rx="2" fill={cell ? COLORS[cell] : '#172127'} stroke={ghost.has(y * WIDTH + x) && !cell ? '#65777c' : '#202c32'} strokeWidth="1" />))}
      </svg>
      {game.over && <div className="board-overlay">FINISHED</div>}
    </div>
    <div className="board-stats"><div><span>SURVIVAL</span><strong>{time(duration)}</strong></div><div><span>LINES</span><strong>{game.lines.toString().padStart(2, '0')}</strong></div></div>
    <div className="next"><span>NEXT</span>{next.map((kind, index) => <svg key={index} width="42" height="28" viewBox="0 0 48 32" aria-label={`Next piece ${['I', 'O', 'T', 'S', 'Z', 'J', 'L'][kind]}`} role="img">{SHAPES[kind].flatMap((row, y) => row.map((cell, x) => cell ? <rect key={`${x}:${y}`} x={x * 10} y={y * 10 + 5} width="9" height="9" rx="1" fill={COLORS[kind + 1]} /> : null))}</svg>)}</div>
  </section>
}

export default function App() {
  const [round, setRound] = useState(0)
  const { view, command, pause, retry } = useMatch(round)
  const start = () => setRound(value => value + 1)
  const running = view && !view.finished
  const status = !view ? 'Ready to play'  : view.error ? 'Connection interrupted' : view.waiting ? 'Jev is choosing · both clocks paused' : view.paused ? 'Match paused' : view.finished ? (view.playerTime === view.jevTime ? 'Draw' : view.playerTime > view.jevTime ? 'You survived longer' : 'Jev survived longer') : 'Survive longer. Play your own board.'
  const controls: [Command, string][] = [['left', 'Left'], ['rotate', 'Rotate'], ['right', 'Right'], ['down', 'Down'], ['drop', 'Drop']]
  return <Theme appearance="dark" accentColor="mint" grayColor="slate" radius="medium">
    <main className="arcade">
      <nav className="masthead"><a href="/">JEV<span> / </span>ARCADE</a><span>01 / TETRIS</span></nav>
      <header className="intro"><div><span className="eyebrow">HUMAN × SYSTEM ONE</span><h1>Outlast.</h1></div><div className="rules">Two boards. Same pieces.<br />The longest survival wins.</div></header>
      <section className="connection" aria-label="Match controls">
        <Button onClick={event => { start(); event.currentTarget.blur() }} disabled={!!running}>Start</Button>
        {running && <Button variant="soft" onClick={event => { pause(); event.currentTarget.blur() }}>{view.paused ? 'Resume' : 'Pause'}</Button>}
        {running && <Button variant="outline" onClick={() => setRound(0)}>Exit</Button>}
      </section>
      <div className="match-status" role="status"><span className={view?.waiting ? 'indicator waiting' : 'indicator'} />{status}{view?.error && <Button size="1" onClick={event => { retry(); event.currentTarget.blur() }}>Retry</Button>}</div>
      <div className="arena">
        <Board game={view?.player ?? EMPTY} label="YOU" duration={view?.playerTime ?? 0} next={view ? view.pieces.slice(view.player.index + 1, view.player.index + 4) : [1, 2, 3]} />
        <aside className="center-rail"><span>VS</span><div>LEVEL<strong>{Math.floor((view?.elapsed ?? 0) / 30000) + 1}</strong></div><div>JEV CALLS<strong>{view?.calls ?? 0}</strong></div><div>INPUT TOKENS<strong>{(view?.tokens ?? 0).toLocaleString()}</strong></div><div>CONFIDENCE<strong>{Math.round((view?.confidence ?? 0) * 100)}%</strong></div></aside>
        <Board game={view?.jev ?? EMPTY} label="JEV" duration={view?.jevTime ?? 0} next={view ? view.pieces.slice(view.jev.index + 1, view.jev.index + 4) : [1, 2, 3]} />
      </div>
      <footer className="controls"><span>← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP</span><div>{controls.map(([action, label]) => <Button key={action} variant="soft" disabled={!running || view.waiting || view.paused || !!view.error || view.player.over} onClick={event => { command(action); event.currentTarget.blur() }}>{label}</Button>)}</div></footer>
    </main>
  </Theme>
}
