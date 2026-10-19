# Auditoría del menú de burbujas

## Resultado

- Registro real: **36 aplicaciones** (`WATCH_APPS`).
- Aplicaciones originales conservadas: **19**.
- Aplicaciones añadidas conservadas: **13**.
- Identificadores duplicados: **0**.
- Burbujas ficticias: **0**.
- La cuadrícula y la lista consumen el mismo registro, por lo que ambas muestran las 36 aplicaciones.
- Cada entrada tiene un icono existente en Ionicons y llega a una pantalla funcional.

## Inventario

| ID | Nombre | Icono | Implementación que abre | Cuadrícula | Lista | Duplicada |
|---|---|---|---|---|---|---|
| activity | Actividad | fitness | WatchAppScreen | Sí | Sí | No |
| heart | Frecuencia | heart | WatchAppScreen | Sí | Sí | No |
| workout | Entreno | walk | WatchAppScreen | Sí | Sí | No |
| messages | Mensajes | chatbubble | WatchAppScreen | Sí | Sí | No |
| phone | Teléfono | call | WatchAppScreen | Sí | Sí | No |
| weather | Tiempo | partly-sunny | WatchAppScreen | Sí | Sí | No |
| music | Música | musical-notes | WatchAppScreen + MusicProvider | Sí | Sí | No |
| maps | Mapas | map | WatchAppScreen | Sí | Sí | No |
| timer | Temporizador | timer | WatchAppScreen | Sí | Sí | No |
| alarm | Alarmas | alarm | WatchAppScreen | Sí | Sí | No |
| calendar | Calendario | calendar | WatchAppScreen | Sí | Sí | No |
| camera | Cámara | camera | WatchAppScreen | Sí | Sí | No |
| photos | Fotos | flower | WatchAppScreen | Sí | Sí | No |
| wallet | Wallet | wallet | WatchAppScreen + Stripe | Sí | Sí | No |
| compass | Brújula | compass | WatchAppScreen | Sí | Sí | No |
| settings | Ajustes | settings | WatchAppScreen | Sí | Sí | No |
| sleep | Sueño | moon | WatchAppScreen | Sí | Sí | No |
| find | Buscar | locate | WatchAppScreen | Sí | Sí | No |
| flashlight | Linterna | flashlight | WatchFlashlight | Sí | Sí | No |
| stopwatch | Cronómetro | stopwatch | WatchAppScreen | Sí | Sí | No |
| voice-memos | Notas de voz | mic | WatchAppScreen | Sí | Sí | No |
| calculator | Calculadora | calculator | WatchAppScreen | Sí | Sí | No |
| notes | Notas | document-text | WatchAppScreen | Sí | Sí | No |
| world-clock | Reloj mundial | globe | AdditionalWatchApps | Sí | Sí | No |
| mindfulness | Atención plena | flower | AdditionalWatchApps | Sí | Sí | No |
| noise | Ruido | ear | AdditionalWatchApps | Sí | Sí | No |
| medications | Medicamentos | medical | AdditionalWatchApps | Sí | Sí | No |
| waypoints | Puntos | flag | AdditionalWatchApps | Sí | Sí | No |
| astronomy | Astronomía | planet | AdditionalWatchApps | Sí | Sí | No |
| handwashing | Lavado de manos | water | AdditionalWatchApps | Sí | Sí | No |
| camera-remote | Obturador remoto | camera-reverse | AdditionalWatchApps | Sí | Sí | No |
| games | Juegos | game-controller | GamesCenter | Sí | Sí | No |

`camera` y `camera-remote` no son duplicadas: la primera captura y administra fotografías; la segunda funciona como obturador remoto. Los cuatro videojuegos permanecen dentro de la única aplicación `games`.

## Separación de interfaces

- **Carátula:** hora, fecha y complicaciones.
- **Aplicaciones:** `WineGlass` renderiza la cuadrícula hexagonal mediante `Bubble` y `PanView`.
- **Pila inteligente y notificaciones:** paneles disponibles únicamente desde la carátula.
- **Botón lateral:** conserva el Centro de control/Dock.
- **Corona:** aplicación → burbujas → carátula → burbujas.

## Causa de la pantalla negra y protección

Cada burbuja nace con profundidad `z=0`, por lo que su escala visual inicial es cero. Además de la carrera entre medición y referencias, la comprobación física en un emulador Android reveló la causa decisiva: Fabric medía `WineGlass` con ancho real, pero con altura `0`. Por eso las referencias existían sin que ninguna pudiera dibujarse.

La cuadrícula ahora espera dimensiones y referencias, recibe directamente el ancho y alto calculados del cristal del reloj y queda anclada a sus cuatro bordes. Al finalizar la entrada —o mediante un cierre de seguridad si la animación es interrumpida— normaliza todas las profundidades al tamaño real. `Bubble` también rechaza coordenadas no finitas para impedir transformaciones `NaN`.

## Comprobación física

La cuadrícula y la apertura de Entreno se comprobaron visualmente en Expo Go dentro del emulador `Pixel_7_API_35`. La interacción final en un teléfono físico todavía debe revisarse con `yarn qr --clear`: arrastrar en varias direcciones, tocar iconos centrales y periféricos, regresar con la corona y alternar entre carátula y cuadrícula.
