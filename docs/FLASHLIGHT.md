# Linterna de pantalla

## Implementación

La misma vista `WatchFlashlight` se abre desde la burbuja **Linterna** y desde
el Centro de control. No existe una segunda implementación ni una burbuja
duplicada.

Incluye los tres modos documentados para Apple Watch:

- blanco fijo;
- blanco intermitente;
- rojo fijo.

Un deslizamiento horizontal cambia entre los modos en ese orden. Los tres
indicadores superiores también permiten seleccionar un modo. La corona o una
pulsación prolongada cierran la vista. El temporizador de la luz intermitente se
elimina al cambiar de modo o salir.

## Brillo y compatibilidad

`expo-brightness` 57.0.2 está incluido en Expo Go. Al abrir la Linterna se lee
el brillo actual de la pantalla, se aplica brillo máximo solamente a la
actividad de la aplicación y se restaura el valor anterior al salir. Si el
dispositivo rechaza esa operación, la superficie blanca/roja continúa
funcionando sin bloquear la interfaz.

No se llama a `setSystemBrightnessAsync`, no se solicita `WRITE_SETTINGS` y no
se modifica el brillo global permanente del teléfono. Tampoco se activa el
flash trasero de la cámara.

## Verificación pendiente

Antes de distribuir una APK se debe comprobar en un teléfono Android físico:

- que el fabricante permite el override temporal del brillo de la actividad;
- que el brillo anterior se restaura al cerrar, bloquear o mandar la app al
  fondo;
- que los tres modos y el gesto horizontal son cómodos y visibles;
- que la luz intermitente se detiene inmediatamente al salir.

