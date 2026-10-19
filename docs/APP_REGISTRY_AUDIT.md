# Auditoría del registro de aplicaciones

Fecha de revisión: 2026-10-19.

## Resultado

- El registro `WATCH_APPS` contiene 36 aplicaciones y 36 identificadores
  únicos.
- La cuadrícula, la lista y el centro de control consumen el mismo registro;
  no mantienen copias independientes que puedan producir burbujas duplicadas.
- Ningún identificador persistente fue eliminado o sustituido.
- `flashlight` — **Linterna** reutiliza la misma vista de luz de pantalla del
  Centro de control; no existe una implementación duplicada.
- La cuadrícula de burbujas vuelve a ser la pantalla inicial. La corona alterna
  entre la cuadrícula y la carátula, que conserva complicaciones, gestos,
  notificaciones y Pila inteligente.

## Aplicaciones relacionadas con cámara

Las dos aplicaciones no abren la misma pantalla y se conservan porque tienen
responsabilidades distintas:

- `camera` — **Cámara**: captura directa, flash, cambio de cámara, vista previa,
  almacenamiento privado y exportación explícita cuando está disponible.
- `camera-remote` — **Obturador remoto**: experiencia de disparador inspirada
  en Camera Remote, con cuenta regresiva de 0, 3 o 10 segundos, cambio de cámara
  y guardado posterior en Fotos del reloj.

La segunda burbuja cambió su nombre visible de “Control cámara” a “Obturador
remoto” y usa un icono diferente. Las fotografías existentes continúan bajo la
misma clave `photos`; no hubo migración destructiva.

## Nombres corregidos

- `handwashing`: **Lavado de manos**. Mantiene temporizador de 20 segundos,
  progreso, historial y vibración opcional; agrega pausa, continuación,
  cancelación y animación durante el conteo.

## Juegos revisados

- NumPuz admite 3×3, 4×4, 5×5 y 6×6, objetivo generado según el tamaño,
  pantalla previa, inicio explícito, pausa, continuación, toque, arrastre y
  desplazamiento de varias fichas alineadas. Los tableros se mezclan mediante
  movimientos legales.
- Rompe Ladrillos convierte la coordenada absoluta del dedo a la coordenada
  local del campo antes de mover la plataforma. La función de límites continúa
  impidiendo que salga del tablero.

## Validación realizada

- ESLint sin errores.
- 58 pruebas unitarias aprobadas, incluidas regresiones del registro, la
  navegación inicial, la distribución y el montaje real de `WineGlass` con
  apertura de las 36 burbujas, validación de profundidad y protección frente
  a transformaciones no finitas.
- Bundle Android de Expo generado correctamente como comprobación y eliminado
  después de validar. No se generó APK.
- Los gestos táctiles y la apariencia final todavía requieren comprobación en
  un teléfono físico; no se consideran físicamente verificados por esta
  auditoría automática.
