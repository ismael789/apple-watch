# Centro de Juegos

La única burbuja **Juegos** contiene cuatro juegos locales. No utilizan red,
servidores, inteligencia artificial ni motores nativos.

## Juegos y controles

- **Gato:** dos jugadores locales, X y O. Detecta las ocho líneas, empates,
  bloquea el tablero terminado y alterna quién inicia cada ronda.
- **NumPuz:** dificultades 3×3, 4×4 y 5×5. Solo mueve fichas ortogonalmente
  adyacentes al hueco. La mezcla se genera mediante movimientos legales desde
  el tablero resuelto, por lo que siempre conserva solución.
- **Rompe Ladrillos:** la plataforma sigue el dedo dentro del campo. La física
  usa tiempo transcurrido y subpasos para evitar atravesar objetos. Incluye
  ladrillos resistentes, tres niveles, tres vidas, pausa y récord.
- **Buscaminas:** alterna con un botón entre descubrir y marcar. Tocar un número
  revelado ejecuta chording cuando sus banderas coinciden. Incluye primer toque
  seguro, expansión de ceros y tres dificultades adaptadas al ancho del reloj.

Cada pantalla dispone de volver y reiniciar. Las partidas se conservan al
regresar al centro. Rompe Ladrillos se pausa al salir o cuando la aplicación
pasa a segundo plano; los cronómetros excluyen el tiempo en segundo plano.

## Persistencia y respuesta

La migración SQLite versión 2 agrega `game_tic_tac_toe`, `game_num_puz`,
`game_breakout` y `game_minesweeper`. Cada tabla está aislada de los datos de
las demás aplicaciones y conserva partida, dificultad, marcadores y récords.
AsyncStorage continúa como respaldo mediante la capa común del proyecto.

Los tonos son ondas breves generadas por el propio código, sin recursos
comerciales. Respetan el ajuste de sonido y no se reproducen mientras Music
está tocando. La respuesta háptica respeta el ajuste general del reloj.
