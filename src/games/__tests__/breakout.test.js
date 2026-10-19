/* eslint-env jest */

import {
  FIELD,
  createBreakout,
  intersects,
  localTouchX,
  movePaddle,
  pauseBreakout,
  startBreakout,
  stepBreakout,
} from '../breakout';

describe('Rompe Ladrillos clásico', () => {
  test('convierte la coordenada de pantalla a coordenada local del tablero', () => {
    expect(localTouchX(412, 150)).toBe(262);
  });

  test('limita la plataforma al campo y arranca desde espera', () => {
    let game = createBreakout();
    expect(movePaddle(game, -100).paddle.x).toBe(0);
    expect(movePaddle(game, 999).paddle.x).toBe(
      FIELD.width - game.paddle.width,
    );
    game = startBreakout(game);
    expect(game.status).toBe('running');
  });

  test('rebota contra paredes', () => {
    const game = {
      ...startBreakout(createBreakout()),
      ball: { x: 5, y: 150, vx: -120, vy: -20, radius: 5 },
    };
    expect(stepBreakout(game, 0.02).ball.vx).toBeGreaterThan(0);
  });

  test('un impacto válido daña un ladrillo y suma puntos', () => {
    const base = startBreakout(createBreakout());
    const brick = base.bricks[0];
    const game = {
      ...base,
      bricks: [{ ...brick, hp: 2 }],
      ball: {
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height + 6,
        vx: 0,
        vy: -100,
        radius: 5,
      },
    };
    const next = stepBreakout(game, 0.02);
    expect(next.score).toBe(10);
    expect(next.bricks[0].hp).toBe(1);
    expect(next.ball.vy).toBeGreaterThan(0);
  });

  test('pierde una sola vida y reinicia la pelota', () => {
    const game = {
      ...startBreakout(createBreakout()),
      ball: { x: 100, y: FIELD.height + 7, vx: 10, vy: 100, radius: 5 },
    };
    const next = stepBreakout(game, 0.01);
    expect(next.lives).toBe(2);
    expect(next.status).toBe('ready');
    expect(stepBreakout(next, 1)).toBe(next);
  });

  test('pierde al agotar vidas y la pausa detiene completamente la física', () => {
    const running = {
      ...startBreakout(createBreakout(1, 20, 1)),
      ball: { x: 100, y: FIELD.height + 7, vx: 10, vy: 100, radius: 5 },
    };
    const lost = stepBreakout(running, 0.01);
    expect(lost.status).toBe('lost');
    expect(lost.lives).toBe(0);
    const paused = pauseBreakout(startBreakout(createBreakout()));
    expect(stepBreakout(paused, 1)).toBe(paused);
  });

  test('el último ladrillo avanza de nivel y el tercero termina en victoria', () => {
    const hitLastBrick = level => {
      const base = startBreakout(createBreakout(level));
      const brick = { ...base.bricks[0], hp: 1 };
      return stepBreakout(
        {
          ...base,
          bricks: [brick],
          ball: {
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height + 6,
            vx: 0,
            vy: -100,
            radius: 5,
          },
        },
        0.02,
      );
    };
    expect(hitLastBrick(1).level).toBe(2);
    expect(hitLastBrick(1).status).toBe('ready');
    expect(hitLastBrick(3).status).toBe('won');
  });

  test('el punto de contacto con la plataforma cambia el ángulo', () => {
    const base = startBreakout(createBreakout());
    const game = {
      ...base,
      ball: {
        x: base.paddle.x + base.paddle.width - 5,
        y: base.paddle.y - 5,
        vx: 0,
        vy: 140,
        radius: 5,
      },
    };
    const next = stepBreakout(game, 0.01);
    expect(next.ball.vy).toBeLessThan(0);
    expect(next.ball.vx).toBeGreaterThan(0);
  });

  test('detecta intersecciones geométricas reales', () => {
    expect(
      intersects(
        { x: 10, y: 10, radius: 2 },
        { x: 11, y: 11, width: 4, height: 4 },
      ),
    ).toBe(true);
  });
});
