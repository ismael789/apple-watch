/* eslint-disable react/prop-types, react/jsx-one-expression-per-line, no-nested-ternary, jsx-a11y/accessible-emoji, no-bitwise */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

import { readStored, writeStored } from '../storage';
import { useMusic } from '../music/MusicProvider';
import {
  createTicTacToe,
  nextTicTacToeRound,
  playTicTacToe,
  resetTicTacToeScores,
} from '../games/ticTacToe';
import {
  createPuzzleSetup,
  pausePuzzle,
  playPuzzle,
  resumePuzzle,
  solvedBoard,
  startPuzzle,
} from '../games/slidingPuzzle';
import {
  chordCell,
  countFlags,
  createMinesweeper,
  revealCell,
  toggleFlag,
} from '../games/minesweeper';
import {
  FIELD,
  createBreakout,
  localTouchX,
  movePaddle,
  pauseBreakout,
  startBreakout,
  stepBreakout,
} from '../games/breakout';

const PUZZLE_SIZES = [3, 4, 5, 6];
const MINE_LEVELS = {
  Fácil: { rows: 6, columns: 6, mines: 6 },
  Normal: { rows: 8, columns: 8, mines: 10 },
  Difícil: { rows: 9, columns: 9, mines: 15 },
};
const NUMBER_COLORS = [
  '#8e8e93',
  '#0a84ff',
  '#30d158',
  '#ff453a',
  '#bf5af2',
  '#ff9f0a',
  '#64d2ff',
  '#ffffff',
  '#d1d1d6',
];

const toneUri = frequency => {
  if (typeof global.btoa !== 'function') return null;
  const sampleRate = 8000;
  const sampleCount = 560;
  const bytes = [];
  const writeText = text => {
    for (let index = 0; index < text.length; index += 1) {
      bytes.push(text.charCodeAt(index));
    }
  };
  const writeNumber = (value, length) => {
    for (let index = 0; index < length; index += 1) {
      bytes.push((value >> (index * 8)) & 255);
    }
  };
  writeText('RIFF');
  writeNumber(36 + sampleCount, 4);
  writeText('WAVEfmt ');
  writeNumber(16, 4);
  writeNumber(1, 2);
  writeNumber(1, 2);
  writeNumber(sampleRate, 4);
  writeNumber(sampleRate, 4);
  writeNumber(1, 2);
  writeNumber(8, 2);
  writeText('data');
  writeNumber(sampleCount, 4);
  for (let index = 0; index < sampleCount; index += 1) {
    const fade = 1 - index / sampleCount;
    bytes.push(
      Math.round(
        128 +
          Math.sin((index * frequency * Math.PI * 2) / sampleRate) * 44 * fade,
      ),
    );
  }
  return `data:audio/wav;base64,${global.btoa(
    String.fromCharCode.apply(null, bytes),
  )}`;
};

const TONES = {
  tap: toneUri(520),
  success: toneUri(880),
  error: toneUri(180),
};

const secondsText = value => {
  const total = Math.max(0, Math.floor(value || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
};

const MineMark = ({ size = 24, color = '#ffffff' }) => (
  <View style={{ width: size, height: size }}>
    {[0, 45, 90, 135].map(rotation => (
      <View
        key={rotation}
        style={[
          styles.mineSpoke,
          {
            left: size / 2 - 1,
            width: 2,
            height: size,
            backgroundColor: color,
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
      />
    ))}
    <View
      style={[
        styles.mineCore,
        {
          left: size * 0.2,
          top: size * 0.2,
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          backgroundColor: color,
        },
      ]}
    />
    <View
      style={[
        styles.mineGlint,
        {
          left: size * 0.34,
          top: size * 0.31,
          width: Math.max(2, size * 0.13),
          height: Math.max(2, size * 0.13),
        },
      ]}
    />
  </View>
);

const GameArtwork = ({ type }) => {
  if (type === 'tic') {
    return (
      <View style={styles.ticArtwork}>
        <View style={[styles.artLine, styles.artLineVerticalOne]} />
        <View style={[styles.artLine, styles.artLineVerticalTwo]} />
        <View style={[styles.artLine, styles.artLineHorizontalOne]} />
        <View style={[styles.artLine, styles.artLineHorizontalTwo]} />
        <Text style={styles.artX}>×</Text>
        <Text style={styles.artO}>○</Text>
      </View>
    );
  }
  if (type === 'puzzle') {
    return (
      <View style={styles.puzzleArtwork}>
        {[1, 2, 3].map(number => (
          <View key={number} style={styles.puzzleArtworkTile}>
            <Text style={styles.puzzleArtworkText}>{number}</Text>
          </View>
        ))}
        <View style={styles.puzzleArtworkBlank} />
      </View>
    );
  }
  if (type === 'breakout') {
    return (
      <View style={styles.breakoutArtwork}>
        <View style={styles.artBricks}>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <View key={index} style={styles.artBrick} />
          ))}
        </View>
        <View style={styles.artBall} />
        <View style={styles.artPaddle} />
      </View>
    );
  }
  return <MineMark size={34} />;
};

const GameButton = ({ label, onPress, color = '#2c2c2e' }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      { backgroundColor: color, opacity: pressed ? 0.65 : 1 },
    ]}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

const GameHeader = ({ title, onBack, onReset }) => (
  <View style={styles.gameHeader}>
    <Pressable accessibilityLabel="Volver a Juegos" onPress={onBack}>
      <Ionicons name="chevron-back-circle" size={30} color="#0a84ff" />
    </Pressable>
    <Text style={styles.gameTitle}>{title}</Text>
    <Pressable accessibilityLabel="Reiniciar partida" onPress={onReset}>
      <Ionicons name="refresh-circle" size={30} color="#ff9f0a" />
    </Pressable>
  </View>
);

const TicTacToe = ({ saved, onSave, onBack, feedback }) => {
  const [game, setGame] = useState(saved || createTicTacToe());
  const update = next => {
    setGame(next);
    onSave(next);
  };
  const play = index => {
    const next = playTicTacToe(game, index);
    if (next === game) return;
    update(next);
    feedback(next.winner ? 'success' : next.draw ? 'warning' : 'tap');
  };
  return (
    <View style={styles.gamePage}>
      <GameHeader
        title="Gato"
        onBack={() => {
          onSave(game);
          onBack();
        }}
        onReset={() => update(createTicTacToe(game.starter, game.scores))}
      />
      <View style={styles.scoreRow}>
        <Text style={styles.xText}>X {game.scores.X}</Text>
        <Text style={styles.drawText}>Empates {game.scores.draws}</Text>
        <Text style={styles.oText}>O {game.scores.O}</Text>
      </View>
      <Text style={styles.statusText}>
        {game.winner
          ? `Ganó ${game.winner}`
          : game.draw
          ? 'Empate'
          : `Turno de ${game.turn}`}
      </Text>
      <View style={styles.ticBoard}>
        {game.board.map((value, index) => (
          <Pressable
            key={String(index)}
            accessibilityLabel={`Casilla ${index + 1}`}
            onPress={() => play(index)}
            style={[
              styles.ticCell,
              game.winningLine.includes(index) && styles.ticWinner,
            ]}
          >
            <Text style={value === 'X' ? styles.ticX : styles.ticO}>
              {value || ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {(game.winner || game.draw) && (
        <GameButton
          label="Otra ronda"
          color="#0a84ff"
          onPress={() => update(nextTicTacToeRound(game))}
        />
      )}
      <GameButton
        label="Reiniciar marcador"
        onPress={() => update(resetTicTacToeScores())}
      />
    </View>
  );
};

const PuzzleTile = ({
  board,
  index,
  interactive,
  number,
  onMove,
  size,
  tileSize,
}) => {
  const translation = useRef(new Animated.ValueXY()).current;
  const emptyIndex = board.indexOf(0);
  const tileRow = Math.floor(index / size);
  const tileColumn = index % size;
  const emptyRow = Math.floor(emptyIndex / size);
  const emptyColumn = emptyIndex % size;
  const aligned = tileRow === emptyRow || tileColumn === emptyColumn;
  const updateTranslation = (dx, dy) => {
    if (!interactive || !aligned || !number) return;
    if (tileRow === emptyRow) {
      const towardEmpty = Math.sign(emptyColumn - tileColumn);
      const distance = Math.max(
        0,
        Math.min(
          Math.abs(emptyColumn - tileColumn) * tileSize,
          dx * towardEmpty,
        ),
      );
      translation.setValue({ x: distance * towardEmpty, y: 0 });
    } else {
      const towardEmpty = Math.sign(emptyRow - tileRow);
      const distance = Math.max(
        0,
        Math.min(Math.abs(emptyRow - tileRow) * tileSize, dy * towardEmpty),
      );
      translation.setValue({ x: 0, y: distance * towardEmpty });
    }
  };
  const finish = (dx, dy) => {
    const horizontal = tileRow === emptyRow;
    const distance = horizontal ? Math.abs(dx) : Math.abs(dy);
    const direction = horizontal
      ? Math.sign(emptyColumn - tileColumn) * dx
      : Math.sign(emptyRow - tileRow) * dy;
    if (
      interactive &&
      aligned &&
      number &&
      direction > 0 &&
      distance >= tileSize * 0.18
    ) {
      onMove(index);
    }
    Animated.spring(translation, {
      toValue: { x: 0, y: 0 },
      speed: 28,
      bounciness: 1,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View
      onMoveShouldSetResponderCapture={(_, gesture) =>
        interactive &&
        aligned &&
        Boolean(number) &&
        (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5)
      }
      onResponderMove={(_, gesture) =>
        updateTranslation(gesture.dx, gesture.dy)
      }
      onResponderRelease={(_, gesture) => finish(gesture.dx, gesture.dy)}
      onResponderTerminate={() => finish(0, 0)}
      style={[
        styles.puzzleTile,
        { width: tileSize - 4, height: tileSize - 4 },
        !number && styles.puzzleEmpty,
        { transform: translation.getTranslateTransform() },
      ]}
    >
      <Pressable
        accessibilityLabel={number ? `Ficha ${number}` : 'Espacio vacío'}
        disabled={!interactive || !number}
        onPress={() => onMove(index)}
        style={styles.puzzleTilePressable}
      >
        {!!number && (
          <Text
            style={[
              styles.puzzleNumber,
              { fontSize: size >= 6 ? 13 : size === 5 ? 16 : 19 },
            ]}
          >
            {number}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const NumPuzzle = ({ saved, onSave, onBack, feedback }) => {
  const stored = saved || {
    size: 3,
    game: createPuzzleSetup(3),
    best: {},
  };
  const storedSize = stored.size || stored.game.size || PUZZLE_SIZES[0];
  const initial = {
    ...stored,
    size: storedSize,
    soundEnabled: stored.soundEnabled !== false,
    best: {
      ...(stored.best || {}),
      ...(stored.difficulty && stored.best && stored.best[stored.difficulty]
        ? { [storedSize]: stored.best[stored.difficulty] }
        : {}),
    },
    game:
      stored.game.status === 'playing'
        ? {
            ...stored.game,
            startedAt: Date.now() - (stored.game.elapsed || 0) * 1000,
          }
        : stored.game,
  };
  const [state, setState] = useState(initial);
  const [clock, setClock] = useState(initial.game.elapsed || 0);
  const [showGoal, setShowGoal] = useState(initial.game.status === 'ready');
  const [soundEnabled, setSoundEnabled] = useState(initial.soundEnabled);
  const backgroundAt = useRef(null);
  useEffect(() => {
    if (state.game.status !== 'playing') return undefined;
    const timer = setInterval(() => {
      setClock(Math.floor((Date.now() - state.game.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.game.startedAt, state.game.status]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') backgroundAt.current = Date.now();
      else if (backgroundAt.current) {
        const pauseDuration = Date.now() - backgroundAt.current;
        setState(current => ({
          ...current,
          game: {
            ...current.game,
            startedAt: current.game.startedAt + pauseDuration,
          },
        }));
        backgroundAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);
  const save = next => {
    setState(next);
    onSave(next);
  };
  const selectSize = size => {
    const next = {
      ...state,
      size,
      game: createPuzzleSetup(size),
    };
    setClock(0);
    setShowGoal(true);
    save(next);
  };
  const start = () => {
    const game = startPuzzle(createPuzzleSetup(state.size));
    setClock(0);
    setShowGoal(false);
    save({ ...state, game });
    feedback('tap', soundEnabled);
  };
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    save({ ...state, soundEnabled: next });
  };
  const togglePause = () => {
    if (state.game.status === 'playing') {
      const game = pausePuzzle({ ...state.game, elapsed: clock });
      setClock(game.elapsed);
      save({ ...state, game });
    } else if (state.game.status === 'paused') {
      save({ ...state, game: resumePuzzle(state.game) });
    }
  };
  const play = index => {
    const game = playPuzzle(state.game, index);
    if (game === state.game) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let best = state.best;
    if (game.status === 'won') {
      const result = {
        seconds: Math.max(clock, game.elapsed),
        moves: game.moves,
      };
      const current = best[state.size];
      best = {
        ...best,
        [state.size]: {
          seconds: current
            ? Math.min(current.seconds, result.seconds)
            : result.seconds,
          moves: current ? Math.min(current.moves, result.moves) : result.moves,
        },
      };
      feedback('success', soundEnabled);
    } else feedback('tap', soundEnabled);
    save({
      ...state,
      game: { ...game, elapsed: Math.max(clock, game.elapsed) },
      best,
    });
  };
  const tileSize = 246 / state.game.size;
  const best = state.best[state.size];
  const visibleBoard = showGoal
    ? solvedBoard(state.game.size)
    : state.game.board;
  return (
    <View style={styles.gamePage}>
      <GameHeader
        title="NumPuz"
        onBack={() => {
          onSave({ ...state, game: { ...state.game, elapsed: clock } });
          onBack();
        }}
        onReset={start}
      />
      <View style={styles.levelRow}>
        {PUZZLE_SIZES.map(size => (
          <Pressable
            key={size}
            onPress={() => selectSize(size)}
            style={[
              styles.levelChip,
              size === state.size && styles.levelChipActive,
            ]}
          >
            <Text style={styles.levelText}>
              {size}×{size}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.puzzleToolRow}>
        <Pressable
          accessibilityLabel="Mostrar u ocultar imagen objetivo"
          onPress={() => setShowGoal(value => !value)}
          style={styles.puzzleTool}
        >
          <Ionicons name="eye" size={15} color="#ffffff" />
          <Text style={styles.puzzleToolText}>
            {showGoal ? 'Partida' : 'Objetivo'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Alternar sonido de NumPuz"
          onPress={toggleSound}
          style={styles.puzzleTool}
        >
          <Ionicons
            name={soundEnabled ? 'volume-high' : 'volume-mute'}
            size={15}
            color={soundEnabled ? '#30d158' : '#8e8e93'}
          />
        </Pressable>
      </View>
      <Text style={styles.statusText}>
        {showGoal
          ? `Imagen objetivo ${state.game.size}×${state.game.size}`
          : state.game.status === 'won'
          ? '¡Completado!'
          : state.game.status === 'paused'
          ? `En pausa · ${state.game.moves} mov · ${secondsText(clock)}`
          : `${state.game.moves} mov · ${secondsText(clock)}`}
      </Text>
      <View style={[styles.puzzleBoard, { width: tileSize * state.game.size }]}>
        {visibleBoard.map((number, index) => (
          <PuzzleTile
            board={visibleBoard}
            index={index}
            interactive={!showGoal && state.game.status === 'playing'}
            key={number || 'empty'}
            number={number}
            onMove={showGoal ? () => {} : play}
            size={state.game.size}
            tileSize={tileSize}
          />
        ))}
      </View>
      {state.game.status === 'ready' ? (
        <GameButton label="Empezar" color="#30d158" onPress={start} />
      ) : (
        <View style={styles.puzzleActions}>
          {state.game.status !== 'won' && (
            <GameButton
              label={state.game.status === 'paused' ? 'Continuar' : 'Pausar'}
              color="#ff9f0a"
              onPress={togglePause}
            />
          )}
          <GameButton label="Nueva partida" onPress={start} />
        </View>
      )}
      {best && (
        <Text style={styles.bestText}>
          Récord {secondsText(best.seconds)} · {best.moves} movimientos
        </Text>
      )}
    </View>
  );
};

const Minesweeper = ({ saved, onSave, onBack, feedback }) => {
  const make = difficulty => {
    const level = MINE_LEVELS[difficulty];
    return createMinesweeper(level.rows, level.columns, level.mines);
  };
  const stored = saved || {
    difficulty: 'Fácil',
    game: make('Fácil'),
    best: {},
  };
  const initial = {
    ...stored,
    game:
      stored.game.status === 'playing'
        ? {
            ...stored.game,
            startedAt: Date.now() - (stored.game.elapsed || 0) * 1000,
          }
        : stored.game,
  };
  const [state, setState] = useState(initial);
  const [mode, setMode] = useState('reveal');
  const [clock, setClock] = useState(initial.game.elapsed || 0);
  const backgroundAt = useRef(null);
  useEffect(() => {
    if (state.game.status !== 'playing') return undefined;
    const timer = setInterval(() => {
      setClock(Math.floor((Date.now() - state.game.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.game.startedAt, state.game.status]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') backgroundAt.current = Date.now();
      else if (backgroundAt.current && state.game.startedAt) {
        const pauseDuration = Date.now() - backgroundAt.current;
        setState(current => ({
          ...current,
          game: {
            ...current.game,
            startedAt: current.game.startedAt + pauseDuration,
          },
        }));
        backgroundAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [state.game.startedAt]);
  const save = next => {
    setState(next);
    onSave(next);
  };
  const newGame = difficulty => {
    const next = { ...state, difficulty, game: make(difficulty) };
    setClock(0);
    setMode('reveal');
    save(next);
  };
  const press = index => {
    const game =
      mode === 'flag'
        ? toggleFlag(state.game, index)
        : revealCell(state.game, index);
    if (game === state.game) return;
    let best = state.best;
    if (game.status === 'won') {
      const current = best[state.difficulty];
      best = {
        ...best,
        [state.difficulty]: current ? Math.min(current, clock) : clock,
      };
      feedback('success');
    } else if (game.status === 'lost') feedback('error');
    else feedback('tap');
    save({ ...state, game: { ...game, elapsed: clock }, best });
  };
  const chord = index => {
    const game = chordCell(state.game, index);
    if (game !== state.game) save({ ...state, game });
  };
  const cellSize = 270 / state.game.columns;
  return (
    <View style={styles.gamePage}>
      <GameHeader
        title="Buscaminas"
        onBack={() => {
          onSave({ ...state, game: { ...state.game, elapsed: clock } });
          onBack();
        }}
        onReset={() => newGame(state.difficulty)}
      />
      <View style={styles.levelRow}>
        {Object.keys(MINE_LEVELS).map(level => (
          <Pressable
            key={level}
            onPress={() => newGame(level)}
            style={[
              styles.levelChip,
              level === state.difficulty && styles.levelChipActive,
            ]}
          >
            <Text style={styles.levelText}>{level}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.mineToolbar}>
        <View style={styles.mineCounterGroup}>
          <MineMark size={12} color="#d1d1d6" />
          <Text style={styles.mineCounter}>
            {state.game.mineCount - countFlags(state.game)}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            setMode(value => (value === 'reveal' ? 'flag' : 'reveal'))
          }
          style={[styles.modeButton, mode === 'flag' && styles.flagMode]}
        >
          <View style={styles.modeContent}>
            <Ionicons
              name={mode === 'flag' ? 'flag' : 'scan-circle'}
              size={13}
              color="#ffffff"
            />
            <Text style={styles.modeText}>
              {mode === 'flag' ? 'Bandera' : 'Descubrir'}
            </Text>
          </View>
        </Pressable>
        <Text style={styles.mineCounter}>{secondsText(clock)}</Text>
      </View>
      <Text style={styles.statusText}>
        {state.game.status === 'won'
          ? '¡Campo despejado!'
          : state.game.status === 'lost'
          ? 'Mina encontrada'
          : 'Toca un número revelado para abrir alrededor'}
      </Text>
      <View
        style={[styles.mineBoard, { width: cellSize * state.game.columns }]}
      >
        {state.game.cells.map((cell, index) => {
          let label = '';
          if (cell.revealed && cell.adjacent) label = String(cell.adjacent);
          return (
            <Pressable
              key={String(index)}
              onPress={() => (cell.revealed ? chord(index) : press(index))}
              style={[
                styles.mineCell,
                { width: cellSize - 2, height: cellSize - 2 },
                cell.revealed && styles.mineRevealed,
                cell.exploded && styles.mineExploded,
              ]}
            >
              {cell.wrongFlag ? (
                <Ionicons name="close" size={14} color="#ff453a" />
              ) : cell.flagged && !cell.revealed ? (
                <Ionicons name="flag" size={13} color="#ff9f0a" />
              ) : cell.revealed && cell.mine ? (
                <MineMark size={13} color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.mineText,
                    { color: NUMBER_COLORS[cell.adjacent] },
                  ]}
                >
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {state.best[state.difficulty] !== undefined && (
        <Text style={styles.bestText}>
          Récord {secondsText(state.best[state.difficulty])}
        </Text>
      )}
    </View>
  );
};

const Breakout = ({ saved, onSave, onBack, feedback }) => {
  const initial =
    saved && saved.game ? saved : { game: createBreakout(), highScore: 0 };
  const [state, setState] = useState(initial);
  const gameRef = useRef(initial.game);
  const frameRef = useRef(null);
  const previousTime = useRef(null);
  const fieldRef = useRef(null);
  const fieldLeft = useRef(0);
  const setGame = game => {
    gameRef.current = game;
    setState(current => ({
      game,
      highScore: Math.max(current.highScore, game.score),
    }));
  };
  useEffect(() => {
    const frame = time => {
      if (previousTime.current === null) previousTime.current = time;
      const elapsed = (time - previousTime.current) / 1000;
      previousTime.current = time;
      const previous = gameRef.current;
      const previousStatus = previous.status;
      const game = stepBreakout(previous, elapsed);
      if (game !== previous) setGame(game);
      if (game.score !== previous.score) feedback('tap');
      if (
        game.status !== previousStatus &&
        (game.status === 'won' || game.status === 'lost')
      ) {
        feedback(game.status === 'won' ? 'success' : 'error');
      }
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') setGame(pauseBreakout(gameRef.current));
    });
    return () => {
      cancelAnimationFrame(frameRef.current);
      subscription.remove();
      onSave({
        game: pauseBreakout(gameRef.current),
        highScore: Math.max(state.highScore, gameRef.current.score),
      });
    };
  }, []);
  const game = state.game;
  const measureField = callback => {
    if (!fieldRef.current || !fieldRef.current.measureInWindow) return;
    fieldRef.current.measureInWindow(x => {
      fieldLeft.current = x;
      if (callback) callback();
    });
  };
  const moveFromTouch = event => {
    const pageX = event.nativeEvent.pageX;
    if (typeof pageX !== 'number') return;
    setGame(movePaddle(gameRef.current, localTouchX(pageX, fieldLeft.current)));
  };
  const grantPaddleControl = event => {
    const pageX = event.nativeEvent.pageX;
    measureField(() => {
      if (typeof pageX === 'number') {
        setGame(
          movePaddle(gameRef.current, localTouchX(pageX, fieldLeft.current)),
        );
      }
    });
  };
  const control = () => {
    const next =
      game.status === 'running' ? pauseBreakout(game) : startBreakout(game);
    setGame(next);
    onSave({
      ...state,
      game: next,
      highScore: Math.max(state.highScore, next.score),
    });
  };
  return (
    <View style={styles.gamePage}>
      <GameHeader
        title="Rompe Ladrillos"
        onBack={() => {
          const next = pauseBreakout(gameRef.current);
          onSave({
            game: next,
            highScore: Math.max(state.highScore, next.score),
          });
          onBack();
        }}
        onReset={() => setGame(createBreakout())}
      />
      <View style={styles.breakoutStats}>
        <Text style={styles.statText}>Puntos {game.score}</Text>
        <Text style={styles.statText}>Nivel {game.level}</Text>
        <Text style={styles.statText}>♥ {game.lives}</Text>
      </View>
      <View
        ref={fieldRef}
        onLayout={() => measureField()}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grantPaddleControl}
        onResponderMove={moveFromTouch}
        style={styles.breakoutField}
      >
        {game.bricks.map(brick => (
          <View
            key={brick.id}
            style={[
              styles.brick,
              {
                left: brick.x,
                top: brick.y,
                width: brick.width,
                height: brick.height,
                backgroundColor: brick.hp > 1 ? '#ff9f0a' : '#0a84ff',
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.ball,
            {
              left: game.ball.x - game.ball.radius,
              top: game.ball.y - game.ball.radius,
            },
          ]}
        />
        <View
          style={[
            styles.paddle,
            {
              left: game.paddle.x,
              top: game.paddle.y,
              width: game.paddle.width,
            },
          ]}
        />
        {game.status !== 'running' && (
          <View style={styles.gameOverlay} pointerEvents="none">
            <Text style={styles.overlayTitle}>
              {game.status === 'won'
                ? '¡Victoria!'
                : game.status === 'lost'
                ? 'Fin del juego'
                : game.status === 'paused'
                ? 'En pausa'
                : 'Toca iniciar'}
            </Text>
          </View>
        )}
      </View>
      <GameButton
        label={
          game.status === 'running'
            ? 'Pausar'
            : game.status === 'lost' || game.status === 'won'
            ? 'Nueva partida'
            : 'Iniciar'
        }
        color={game.status === 'running' ? '#ff9f0a' : '#30d158'}
        onPress={() => {
          if (game.status === 'lost' || game.status === 'won')
            setGame(createBreakout());
          else control();
        }}
      />
      <Text style={styles.bestText}>Récord {state.highScore}</Text>
    </View>
  );
};

const GAMES = [
  {
    id: 'tic',
    name: 'Gato',
    artwork: 'tic',
    color: '#0a84ff',
    subtitle: '2 jugadores',
  },
  {
    id: 'puzzle',
    name: 'NumPuz',
    artwork: 'puzzle',
    color: '#30d158',
    subtitle: '3×3 · 4×4 · 5×5',
  },
  {
    id: 'breakout',
    name: 'Rompe Ladrillos',
    artwork: 'breakout',
    color: '#ff9f0a',
    subtitle: '3 niveles',
  },
  {
    id: 'mines',
    name: 'Buscaminas',
    artwork: 'mines',
    color: '#ff453a',
    subtitle: '3 dificultades',
  },
];

const GamesCenter = ({ settings }) => {
  const music = useMusic();
  const tapPlayer = useAudioPlayer(TONES.tap);
  const successPlayer = useAudioPlayer(TONES.success);
  const errorPlayer = useAudioPlayer(TONES.error);
  const [active, setActive] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState({});
  useEffect(() => {
    Promise.all([
      readStored('gameTicTacToe', null),
      readStored('gameNumPuz', null),
      readStored('gameBreakout', null),
      readStored('gameMinesweeper', null),
    ]).then(([tic, puzzle, breakout, mines]) => {
      setSaved({ tic, puzzle, breakout, mines });
      setLoaded(true);
    });
  }, []);
  const save = (id, value) => {
    const keys = {
      tic: 'gameTicTacToe',
      puzzle: 'gameNumPuz',
      breakout: 'gameBreakout',
      mines: 'gameMinesweeper',
    };
    setSaved(current => ({ ...current, [id]: value }));
    writeStored(keys[id], value);
  };
  const feedback = (type, allowSound = true) => {
    if (allowSound && settings.sound && !music.status.playing) {
      const player =
        type === 'success'
          ? successPlayer
          : type === 'error'
          ? errorPlayer
          : tapPlayer;
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => {});
    }
    if (!settings.haptics) return;
    if (type === 'tap') Haptics.selectionAsync().catch(() => {});
    else {
      const notification =
        type === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : type === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error;
      Haptics.notificationAsync(notification).catch(() => {});
    }
  };
  if (!loaded) return <Text style={styles.loading}>Cargando partidas…</Text>;
  const common = { onBack: () => setActive(null), feedback };
  if (active === 'tic')
    return (
      <TicTacToe
        saved={saved.tic}
        onSave={value => save('tic', value)}
        {...common}
      />
    );
  if (active === 'puzzle')
    return (
      <NumPuzzle
        saved={saved.puzzle}
        onSave={value => save('puzzle', value)}
        {...common}
      />
    );
  if (active === 'breakout')
    return (
      <Breakout
        saved={saved.breakout}
        onSave={value => save('breakout', value)}
        {...common}
      />
    );
  if (active === 'mines')
    return (
      <Minesweeper
        saved={saved.mines}
        onSave={value => save('mines', value)}
        {...common}
      />
    );
  return (
    <View style={styles.center}>
      <Text style={styles.centerTitle}>Centro de Juegos</Text>
      <View style={styles.gameGrid}>
        {GAMES.map(game => (
          <Pressable
            key={game.id}
            onPress={() => {
              feedback('tap');
              setActive(game.id);
            }}
            style={({ pressed }) => [
              styles.gameCard,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.gameIcon, { backgroundColor: game.color }]}>
              <GameArtwork type={game.artwork} />
            </View>
            <Text style={styles.cardTitle}>{game.name}</Text>
            <Text style={styles.cardSubtitle}>
              {saved[game.id] ? 'Continuar · ' : ''}
              {game.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.offline}>
        Todos los juegos funcionan sin internet
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { width: '100%', alignItems: 'center' },
  centerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  gameGrid: { width: 276, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gameCard: {
    width: 133,
    minHeight: 130,
    padding: 12,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  gameIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticArtwork: { width: 36, height: 36 },
  artLine: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  artLineVerticalOne: { left: 11, top: 1, width: 1.5, height: 34 },
  artLineVerticalTwo: { left: 23, top: 1, width: 1.5, height: 34 },
  artLineHorizontalOne: { left: 1, top: 11, width: 34, height: 1.5 },
  artLineHorizontalTwo: { left: 1, top: 23, width: 34, height: 1.5 },
  artX: {
    position: 'absolute',
    left: 1,
    top: -5,
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  artO: {
    position: 'absolute',
    right: 0,
    bottom: -4,
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  puzzleArtwork: {
    width: 36,
    height: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  puzzleArtworkTile: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  puzzleArtworkBlank: { width: 17, height: 17 },
  puzzleArtworkText: { color: '#16713a', fontSize: 10, fontWeight: '900' },
  breakoutArtwork: { width: 38, height: 38 },
  artBricks: {
    width: 38,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  artBrick: {
    width: 11,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: '#ffffff',
  },
  artBall: {
    position: 'absolute',
    right: 8,
    top: 18,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  artPaddle: {
    position: 'absolute',
    left: 8,
    bottom: 2,
    width: 23,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  mineSpoke: { position: 'absolute', top: 0, borderRadius: 2 },
  mineCore: { position: 'absolute' },
  mineGlint: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 9 },
  cardSubtitle: { color: '#8e8e93', fontSize: 9, lineHeight: 13, marginTop: 3 },
  offline: { color: '#636366', fontSize: 9, marginTop: 14 },
  loading: { color: '#8e8e93', fontSize: 12 },
  gamePage: { width: 290, alignItems: 'center' },
  gameHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gameTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  button: {
    minWidth: 120,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scoreRow: {
    width: 240,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  xText: { color: '#0a84ff', fontSize: 13, fontWeight: '800' },
  oText: { color: '#ff375f', fontSize: 13, fontWeight: '800' },
  drawText: { color: '#8e8e93', fontSize: 11 },
  statusText: {
    color: '#d1d1d6',
    fontSize: 11,
    minHeight: 20,
    textAlign: 'center',
  },
  ticBoard: { width: 240, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  ticCell: {
    width: 78,
    height: 78,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  ticWinner: {
    backgroundColor: '#144b2b',
    borderWidth: 2,
    borderColor: '#30d158',
  },
  ticX: { color: '#0a84ff', fontSize: 44, fontWeight: '500' },
  ticO: { color: '#ff375f', fontSize: 44, fontWeight: '500' },
  levelRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 7,
  },
  levelChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: '#2c2c2e',
  },
  levelChipActive: { backgroundColor: '#0a84ff' },
  levelText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  puzzleBoard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    borderRadius: 16,
    backgroundColor: '#111113',
  },
  puzzleTile: {
    margin: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30d158',
  },
  puzzleTilePressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleEmpty: { backgroundColor: 'transparent' },
  puzzleNumber: { color: '#fff', fontSize: 19, fontWeight: '800' },
  puzzleToolRow: {
    width: 246,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  puzzleTool: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#2c2c2e',
  },
  puzzleToolText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  puzzleActions: { flexDirection: 'row', gap: 7 },
  bestText: { color: '#8e8e93', fontSize: 9, marginTop: 8 },
  mineToolbar: {
    width: 276,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mineCounter: {
    color: '#d1d1d6',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  mineCounterGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: '#2c2c2e',
  },
  flagMode: { backgroundColor: '#ff9f0a' },
  modeContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  mineBoard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
    backgroundColor: '#111113',
  },
  mineCell: {
    margin: 1,
    borderRadius: 4,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mineRevealed: { backgroundColor: '#1c1c1e' },
  mineExploded: { backgroundColor: '#ff453a' },
  mineText: { fontSize: 12, fontWeight: '900' },
  breakoutStats: {
    width: FIELD.width,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statText: { color: '#d1d1d6', fontSize: 10, fontWeight: '700' },
  breakoutField: {
    width: FIELD.width,
    height: FIELD.height,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  brick: { position: 'absolute', borderRadius: 3 },
  ball: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  paddle: {
    position: 'absolute',
    height: 9,
    borderRadius: 5,
    backgroundColor: '#30d158',
  },
  gameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
});

export default GamesCenter;
