# Expansión funcional inspirada en watchOS

Esta ampliación conserva las 19 aplicaciones originales y la cuadrícula de
burbujas. `Bubble.js`, `WineGlass.js` y `PanView.js` no se modificaron.

## Funciones incorporadas

- **Recordatorios:** listas, prioridad, fecha y hora, completar, mostrar u
  ocultar completados y borrado. Los datos viven en SQLite y los avisos usan
  notificaciones locales de Expo. Android puede entregar un aviso con cierto
  retraso si no se concede permiso de alarmas exactas; el proyecto no solicita
  ese permiso restringido.
- **En reproducción:** comparte pista, estado, progreso, volumen y controles
  con `MusicProvider`; no existe un reproductor duplicado.
- **Cronómetro:** vistas Digital, Analógica, Gráfica e Híbrida sobre un único
  estado. Continúa al cambiar de aplicación mientras el proceso siga vivo.
- **Atajos:** crea, ejecuta y elimina accesos a acciones internas reales. Los
  atajos se guardan en SQLite.
- **Modo Cine y Concentración:** están en el Centro de control y se conservan
  en Ajustes. Modo Cine oscurece la esfera hasta tocar o pulsar la corona.
- **Recientes y organización:** el Dock usa historial real. El orden se puede
  editar desde la vista de lista y se guarda en SQLite; hay restauración del
  orden original. Se eligieron controles explícitos para no interferir con el
  arrastre panorámico original de la cuadrícula.
- **Walkie-Talkie:** incluye preparación de permiso de micrófono y estados
  honestos. La transmisión está deshabilitada hasta disponer de un segundo
  cliente, servidor de señalización y transporte de audio en tiempo real. Una
  solución WebRTC necesitaría una biblioteca nativa y por ello un Development
  Build; no puede añadirse de forma real únicamente dentro de Expo Go.

## Persistencia

La migración 3 crea, sin borrar tablas anteriores, `reminders`,
`reminder_lists`, `shortcuts` y `app_order`. Las preferencias de Modo Cine,
Concentración y el historial reciente usan el almacenamiento estructurado
existente.

## Referencias oficiales

- Apple Watch User Guide: Recordatorios, En reproducción, Cronómetro, Atajos,
  Walkie-Talkie, Concentración, Modo Cine y organización de aplicaciones.
- Expo Notifications documenta notificaciones locales en Expo Go, pero la
  compilación de Expo Go comprobada con SDK 57 no incluía
  `ExpoTopicSubscriptionModule`. Por ello el proyecto carga el módulo sólo en
  APK/Development Build y mantiene Recordatorios operativo, sin avisos del
  sistema, dentro de Expo Go.
