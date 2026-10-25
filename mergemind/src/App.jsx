import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const SIZE = 4;
const BEST_KEY = "mergemind2048-best";

function createBoard() {
  const board = Array(SIZE * SIZE).fill(0);
  addRandomTile(board);
  addRandomTile(board);
  return board;
}

function addRandomTile(board) {
  const empty = [];

  board.forEach((value, index) => {
    if (value === 0) empty.push(index);
  });

  if (empty.length > 0) {
    const index = empty[Math.floor(Math.random() * empty.length)];
    board[index] = Math.random() < 0.9 ? 2 : 4;
  }

  return board;
}

function slideLine(line) {
  const values = line.filter((value) => value !== 0);
  const result = [];
  let gained = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      gained += merged;
      i++;
    } else {
      result.push(values[i]);
    }
  }

  while (result.length < SIZE) result.push(0);

  return { line: result, gained };
}

function moveBoard(board, direction) {
  const next = Array(SIZE * SIZE).fill(0);
  let gained = 0;

  for (let i = 0; i < SIZE; i++) {
    let line = [];

    for (let j = 0; j < SIZE; j++) {
      const index =
        direction === "left" || direction === "right"
          ? i * SIZE + j
          : j * SIZE + i;

      line.push(board[index]);
    }

    if (direction === "right" || direction === "down") {
      line.reverse();
    }

    const result = slideLine(line);
    line = result.line;
    gained += result.gained;

    if (direction === "right" || direction === "down") {
      line.reverse();
    }

    for (let j = 0; j < SIZE; j++) {
      const index =
        direction === "left" || direction === "right"
          ? i * SIZE + j
          : j * SIZE + i;

      next[index] = line[j];
    }
  }

  return { board: next, gained };
}

function canMove(board) {
  if (board.some((value) => value === 0)) return true;

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const index = row * SIZE + col;

      if (col < SIZE - 1 && board[index] === board[index + 1]) {
        return true;
      }

      if (row < SIZE - 1 && board[index] === board[index + SIZE]) {
        return true;
      }
    }
  }

  return false;
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const [board, setBoard] = useState(createBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [history, setHistory] = useState([]);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const touchStart = useRef(null);
  const audioContext = useRef(null);

  const playSound = useCallback(
    (frequency = 440) => {
      if (!soundOn) return;

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext.current) {
          audioContext.current = new AudioContextClass();
        }

        const context = audioContext.current;

        if (context.state === "suspended") {
          context.resume();
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.055, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + 0.09
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start();
        oscillator.stop(context.currentTime + 0.09);
      } catch {
        // Sound is optional.
      }
    },
    [soundOn]
  );

  const startNewGame = useCallback(() => {
    setBoard(createBoard());
    setScore(0);
    setHistory([]);
    setWon(false);
    setKeepPlaying(false);
    setGameOver(false);
    setShowNewGame(false);
  }, []);

  const makeMove = useCallback(
    (direction) => {
      // Stop moves after game over or until the player chooses to continue.
      if (gameOver || (won && !keepPlaying)) return;

      const result = moveBoard(board, direction);

      const changed = result.board.some(
        (value, index) => value !== board[index]
      );

      // An invalid move should not change the score or spawn a tile.
      if (!changed) return;

      const nextBoard = addRandomTile(result.board);
      const nextScore = score + result.gained;

      // Trigger the first win when a tile reaches 2048.
      const reached2048 =
        !won && nextBoard.some((value) => value >= 2048);

      const nextGameOver = !canMove(nextBoard);

      setHistory((previous) =>
        [
          ...previous,
          {
            board: [...board],
            score,
            won,
            keepPlaying,
            gameOver,
          },
        ].slice(-50)
      );

      setBoard(nextBoard);
      setScore(nextScore);

      if (nextScore > best) {
        setBest(nextScore);

        try {
          localStorage.setItem(BEST_KEY, String(nextScore));
        } catch {
          // Best score remains available for this session.
        }
      }

      if (reached2048) {
        setWon(true);
        setGameOver(false);
      } else {
        setGameOver(nextGameOver);
      }

      playSound(result.gained ? 660 : 330);
    },
    [board, score, best, gameOver, won, keepPlaying, playSound]
  );

  const undoMove = useCallback(() => {
    if (history.length === 0) return;

    const previous = history[history.length - 1];

    setBoard(previous.board);
    setScore(previous.score);
    setWon(previous.won);
    setKeepPlaying(previous.keepPlaying);
    setGameOver(previous.gameOver);

    setHistory((items) => items.slice(0, -1));
  }, [history]);

  useEffect(() => {
    function handleKeyDown(event) {
      const directions = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (directions[event.key]) {
        event.preventDefault();
        makeMove(directions[event.key]);
      } else if (event.key.toLowerCase() === "u") {
        undoMove();
      } else if (event.key.toLowerCase() === "r") {
        setShowNewGame(true);
      } else if (event.key === "Escape") {
        setShowNewGame(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [makeMove, undoMove]);

  function handleTouchStart(event) {
    const touch = event.touches[0];

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd(event) {
    if (!touchStart.current) return;

    const touch = event.changedTouches[0];

    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;

    touchStart.current = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 25) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      makeMove(deltaX > 0 ? "right" : "left");
    } else {
      makeMove(deltaY > 0 ? "down" : "up");
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#home" aria-label="MergeMind home">
          <span className="brand-icon">M</span>
          <span>
            Merge<span className="brand-accent">Mind</span>
          </span>
        </a>

        <div className="topbar-right">
          <span className="edition">
            <span className="live-dot" /> ARCADE EDITION
          </span>

          <button
            className={`icon-button ${soundOn ? "active" : ""}`}
            onClick={() => setSoundOn((value) => !value)}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? "♫" : "♪"}
          </button>
        </div>
      </header>

      <section className="game-layout" id="home">
        <div className="intro">
          <div className="eyebrow">
            <span /> THE NUMBER PUZZLE
          </div>

          <h1>
            Think. Merge.
            <br />
            <span>Dominate.</span>
          </h1>

          <p className="subtitle">
            Every move matters. Combine matching tiles, build your score, and
            reach the legendary 2048.
          </p>

          <div className="stats">
            <div className="stat-card">
              <span className="stat-label">CURRENT SCORE</span>
              <strong>{score.toLocaleString()}</strong>
              <span className="stat-foot">Your run, your record</span>
            </div>

            <div className="stat-card best-card">
              <span className="stat-label">
                <span className="trophy">✦</span> BEST SCORE
              </span>
              <strong>{best.toLocaleString()}</strong>
              <span className="stat-foot">Keep pushing higher</span>
            </div>
          </div>

          <div className="controls-card">
            <div className="controls-heading">
              <span className="control-symbol">⌘</span>
              <div>
                <strong>HOW TO PLAY</strong>
                <span>Simple to learn. Hard to master.</span>
              </div>
            </div>

            <div className="control-row">
              <div className="arrow-keys" aria-label="Arrow key controls">
                <kbd>↑</kbd>
                <div>
                  <kbd>←</kbd>
                  <kbd>↓</kbd>
                  <kbd>→</kbd>
                </div>
              </div>
              <p>
                Use your <b>arrow keys</b> to move every tile.
              </p>
            </div>

            <div className="control-row">
              <div className="merge-icon">
                2<span>+</span>2
              </div>
              <p>
                Matching numbers <b>merge into one</b> and add to your score.
              </p>
            </div>

            <div className="control-row">
              <div className="goal-icon">2048</div>
              <p>
                Reach <b>2048</b> to win. Don't run out of moves!
              </p>
            </div>
          </div>

          <div className="tip">
            <span>✧</span> PRO TIP: Plan two moves ahead. Every empty cell
            counts.
          </div>
        </div>

        <div className="game-column">
          <div className="board-topline">
            <div>
              <span className="board-kicker">YOUR PLAYGROUND</span>
              <h2>
                Merge <span>Grid</span>
              </h2>
            </div>

            <span className="level-tag">
              <span /> LEVEL 01
            </span>
          </div>

          <div className="board-frame">
            <div
              className="game-board"
              role="application"
              aria-label="2048 game board. Use arrow keys or swipe to move tiles."
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {board.map((value, index) => (
                <div
                  className={`tile ${
                    value ? `tile-${Math.min(value, 2048)}` : "tile-empty"
                  }`}
                  key={index}
                  aria-label={value ? String(value) : "Empty"}
                >
                  {value !== 0 && (
                    <span className="tile-value">{value}</span>
                  )}
                </div>
              ))}

              {(won || gameOver) && (
                <div className="board-overlay">
                  <div className="result-panel">
                    <div className="result-icon">{won ? "✦" : "⌁"}</div>

                    <span className="result-kicker">
                      {won ? "INCREDIBLE WORK" : "NO MORE MOVES"}
                    </span>

                    <h3>{won ? "You did it!" : "Game over"}</h3>

                    <p>
                      {won
                        ? "You reached 2048. Keep playing or claim your victory."
                        : `You scored ${score.toLocaleString()} points. Ready for another run?`}
                    </p>

                    {won && !keepPlaying && (
                      <button
                        className="primary-button"
                        onClick={() => setKeepPlaying(true)}
                      >
                        Keep Playing <span>→</span>
                      </button>
                    )}

                    <button
                      className="secondary-button"
                      onClick={startNewGame}
                    >
                      Play Again ↻
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="board-bottomline">
              <span>
                <span className="live-dot" />{" "}
                {gameOver ? "GAME OVER" : won ? "2048 ACHIEVED" : "GAME IN PROGRESS"}
              </span>
              <span>
                4 × 4 GRID <b>•</b> 2048 GOAL
              </span>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="primary-button"
              onClick={() => setShowNewGame(true)}
            >
              <span className="button-symbol">↻</span> New Game
            </button>

            <button
              className="secondary-button"
              onClick={undoMove}
              disabled={history.length === 0}
            >
              <span className="button-symbol">↶</span> Undo
            </button>
          </div>

          <div className="mobile-hint">
            <span>☝</span> Swipe anywhere on the board to move tiles
          </div>

          <div className="keyboard-hint">
            <kbd>U</kbd> UNDO <span>·</span> <kbd>R</kbd> NEW GAME
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-icon small">M</span> MergeMind{" "}
          <span>2048</span>
        </div>

        <p>
          BUILT FOR CURIOUS MINDS <span>✦</span> ONE MOVE AT A TIME
        </p>

        <span className="footer-version">V1.0.0</span>
      </footer>

      {showNewGame && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowNewGame(false)}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-icon">↻</div>

            <h3 id="confirm-title">Start a new game?</h3>

            <p>
              Your current board and score will be reset. Your best score will
              stay saved.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setShowNewGame(false)}
              >
                Keep Playing
              </button>

              <button className="primary-button" onClick={startNewGame}>
                New Game <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}