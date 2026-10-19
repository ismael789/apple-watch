export const FIELD = Object.freeze({ width: 280, height: 320 });
const BALL_RADIUS = 5;
const PADDLE_WIDTH = 58;
const PADDLE_HEIGHT = 9;

export const createBricks = (level = 1) => {
  const columns = 5;
  const rows = 4 + Math.min(level - 1, 2);
  const gap = 4;
  const width = (FIELD.width - 20 - gap * (columns - 1)) / columns;
  return Array.from({ length: rows * columns }, (_, index) => ({
    id: `${level}-${index}`,
    x: 10 + (index % columns) * (width + gap),
    y: 24 + Math.floor(index / columns) * 17,
    width,
    height: 12,
    hp: level > 1 && Math.floor(index / columns) === 0 ? 2 : 1,
  }));
};

export const createBreakout = (level = 1, score = 0, lives = 3) => ({
  level,
  score,
  lives,
  status: 'ready',
  paddle: {
    x: (FIELD.width - PADDLE_WIDTH) / 2,
    y: FIELD.height - 24,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  },
  ball: {
    x: FIELD.width / 2,
    y: FIELD.height - 38,
    vx: 95 + level * 8,
    vy: -145 - level * 8,
    radius: BALL_RADIUS,
  },
  bricks: createBricks(level),
});

export const movePaddle = (game, centerX) => ({
  ...game,
  paddle: {
    ...game.paddle,
    x: Math.max(
      0,
      Math.min(
        FIELD.width - game.paddle.width,
        centerX - game.paddle.width / 2,
      ),
    ),
  },
});

export const localTouchX = (pageX, fieldLeft) => pageX - fieldLeft;

const intersects = (ball, rectangle) =>
  ball.x + ball.radius >= rectangle.x &&
  ball.x - ball.radius <= rectangle.x + rectangle.width &&
  ball.y + ball.radius >= rectangle.y &&
  ball.y - ball.radius <= rectangle.y + rectangle.height;

const resetBall = game => ({
  ...game,
  status: 'ready',
  ball: {
    ...game.ball,
    x: game.paddle.x + game.paddle.width / 2,
    y: game.paddle.y - BALL_RADIUS - 2,
    vx: 95 + game.level * 8,
    vy: -145 - game.level * 8,
  },
});

const stepOnce = (game, delta) => {
  const ball = {
    ...game.ball,
    x: game.ball.x + game.ball.vx * delta,
    y: game.ball.y + game.ball.vy * delta,
  };
  let bricks = game.bricks;
  let score = game.score;
  if (ball.x - ball.radius <= 0 && ball.vx < 0) {
    ball.x = ball.radius;
    ball.vx *= -1;
  } else if (ball.x + ball.radius >= FIELD.width && ball.vx > 0) {
    ball.x = FIELD.width - ball.radius;
    ball.vx *= -1;
  }
  if (ball.y - ball.radius <= 0 && ball.vy < 0) {
    ball.y = ball.radius;
    ball.vy *= -1;
  }
  if (ball.vy > 0 && intersects(ball, game.paddle)) {
    const contact =
      (ball.x - (game.paddle.x + game.paddle.width / 2)) /
      (game.paddle.width / 2);
    const speed = Math.min(260, Math.hypot(ball.vx, ball.vy) * 1.02);
    ball.vx = Math.max(-210, Math.min(210, contact * speed * 0.85));
    ball.vy = -Math.sqrt(Math.max(80 * 80, speed * speed - ball.vx * ball.vx));
    ball.y = game.paddle.y - ball.radius;
  }
  const hitIndex = bricks.findIndex(brick => intersects(ball, brick));
  if (hitIndex >= 0) {
    const hit = bricks[hitIndex];
    bricks = bricks
      .map((brick, index) =>
        index === hitIndex ? { ...brick, hp: brick.hp - 1 } : brick,
      )
      .filter(brick => brick.hp > 0);
    score += 10;
    const overlapLeft = ball.x + ball.radius - hit.x;
    const overlapRight = hit.x + hit.width - (ball.x - ball.radius);
    const overlapTop = ball.y + ball.radius - hit.y;
    const overlapBottom = hit.y + hit.height - (ball.y - ball.radius);
    if (
      Math.min(overlapLeft, overlapRight) < Math.min(overlapTop, overlapBottom)
    )
      ball.vx *= -1;
    else ball.vy *= -1;
  }
  if (ball.y - ball.radius > FIELD.height) {
    const lives = game.lives - 1;
    return lives <= 0
      ? { ...game, ball, bricks, score, lives: 0, status: 'lost' }
      : resetBall({ ...game, ball, bricks, score, lives });
  }
  if (!bricks.length) {
    return game.level >= 3
      ? { ...game, ball, bricks, score, status: 'won' }
      : createBreakout(game.level + 1, score, game.lives);
  }
  return { ...game, ball, bricks, score };
};

export const stepBreakout = (game, elapsedSeconds) => {
  if (game.status !== 'running') return game;
  const elapsed = Math.max(0, Math.min(elapsedSeconds, 0.05));
  const steps = Math.max(1, Math.ceil(elapsed / 0.006));
  let next = game;
  for (let index = 0; index < steps; index += 1) {
    next = stepOnce(next, elapsed / steps);
    if (next.status !== 'running') break;
  }
  return next;
};

export const startBreakout = game =>
  game.status === 'ready' || game.status === 'paused'
    ? { ...game, status: 'running' }
    : game;

export const pauseBreakout = game =>
  game.status === 'running' ? { ...game, status: 'paused' } : game;

export { intersects };
