# Funciones de watchOS representadas

Este proyecto es un simulador educativo inspirado en Apple Watch. No es un producto de Apple y no usa recursos gráficos extraídos de watchOS.

| Función | Referencia oficial | Implementación del simulador | Límite conocido |
| --- | --- | --- | --- |
| Esferas, colores y complicaciones | [Personalizar la esfera](https://support.apple.com/guide/watch/change-the-watch-face-apda6559ad78/watchos) y [añadir complicaciones](https://support.apple.com/guide/watch/add-complications-apd8d0b9c582/watchos) | Tres composiciones originales, cinco colores y complicaciones enlazadas a Actividad, Tiempo, Alarmas, Batería y Ajustes. | No copia esferas ni gráficos de Apple. |
| Centro de control | [Primeros pasos con Apple Watch](https://support.apple.com/guide/watch/get-started-with-applewatch-apd1456230aa/watchos) | El botón lateral abre sonido, brillo, hápticos, linterna, bloqueo, estado de red/batería y conserva las favoritas previas. | No cambia el Wi‑Fi del teléfono; solamente muestra su estado autorizado. |
| Notificaciones | [Ver y gestionar notificaciones](https://support.apple.com/guide/watch/change-notification-settings-apd9b833c9f3/watchos) | Deslizar hacia abajo muestra alarmas, eventos y batería baja reales del simulador/teléfono. | Es un centro interno, no intercepta notificaciones privadas de Android. |
| Pila inteligente | [Widgets en la Pila inteligente](https://support.apple.com/guide/watch/use-the-smart-stack-to-view-live-activities-apdecf142fb9/watchos) | Deslizar hacia arriba o tocar dos veces muestra widgets con eventos, alarma, actividad, música y batería existentes. | La selección es local; no emplea predicción de watchOS. |
| Linterna | [Usar la linterna](https://support.apple.com/guide/watch/use-the-flashlight-apde99fd96c4/watchos) | La pantalla ofrece luz blanca, roja y blanca alternativa desde el Centro de control. | Ilumina con la pantalla del teléfono, no con hardware de reloj. |
| Notas de voz | [Grabar y reproducir notas de voz](https://support.apple.com/es-mx/guide/watch/-apd441786282/watchos) | Grabación y reproducción mediante el micrófono, con archivos guardados en almacenamiento privado. | Requiere permiso de micrófono; no sincroniza con iCloud. |
| Calculadora | [Usar Calculadora](https://support.apple.com/es-es/guide/watch/apdc0baea711/watchos) | Operaciones aritméticas básicas, porcentaje y cambio de signo. | La función regional de propinas no se añadió todavía. |
| Contactos | [Guía de Apple Watch: Contactos](https://support.apple.com/guide/watch/contacts-apd82b9c9914/watchos) | Teléfono y Mensajes consultan contactos locales después de pedir permiso. | No realiza llamadas ni envía mensajes sin una integración nativa/autorizada. |
| Notas | [Crear y ver notas](https://support.apple.com/guide/watch/create-and-view-notes-apdc6fb0a03f/watchos) | Crea, consulta, fija y elimina notas privadas locales. | Notes llegó a Apple Watch en watchOS 26; no sincroniza con iCloud. |
| Código | [Gestionar el código](https://support.apple.com/guide/watch/manage-your-passcode-lw8k6m6r0ur6/watchos) | Código simple de cuatro dígitos, configurable en Ajustes y bloqueo manual desde Control Center. | Es un bloqueo educativo dentro de la app, no seguridad del sistema Android. |
| Always‑On | [Usar Always On](https://support.apple.com/en-us/105074) | Atenúa la esfera virtual después de inactividad y despierta al tocarla. | Android puede apagar la pantalla; la función real no existe en todos los modelos (Apple indica Series 5 o posterior, Ultra o posterior y SE 3). |
| Gestos y botones | [Usar botones y gestos](https://support.apple.com/guide/watch/use-buttons-and-gestures-apd06bc15da1/watchos) y [Double Tap](https://support.apple.com/guide/watch/use-double-tap-for-common-actions-apdabb7b275c/watchos) | Corona: esfera/cuadrícula/volver; botón lateral: Centro de control; deslizamientos verticales; doble toque táctil para Smart Stack. | No detecta el gesto de dedos en el aire. Double Tap real exige modelos compatibles. |

## Persistencia y datos

- Ajustes, notas, código y metadatos se guardan en el almacenamiento privado de la aplicación.
- Las notas de voz se copian físicamente al área privada administrada por `storageManager`.
- En Expo Go esos archivos pertenecen al espacio privado de Expo Go. En la futura APK, `WatchStorageModule` los dirige al directorio específico de `com.ismael.watchhome` bajo `Android/data` cuando Android lo proporciona.
- `Android/obb` continúa reservado para archivos de expansión legítimos y no se usa para notas de voz ni datos ordinarios.
- Las complicaciones no presentan mediciones inventadas: muestran el dato disponible o indican que aún no existe.

## Expansión funcional

También se incorporaron Reloj mundial con zonas IANA, Atención plena, Ruido ambiental relativo, Medicamentos, puntos GPS, astronomía local, lavado de manos y Control remoto de cámara. Estas categorías aparecen en la guía oficial de Apple Watch como aplicaciones o complicaciones reales. La implementación usa diseños e iconos propios.

- Ruido muestra `dBFS` relativo entregado por el micrófono; no lo presenta como una medición calibrada de dB SPL.
- Medicamentos no recomienda tratamientos. Los avisos internos funcionan mientras el simulador está abierto; recordatorios en segundo plano requerirán notificaciones locales y validación física.
- Los puntos de referencia guardan coordenadas reales únicamente después de autorizar GPS.
- Amanecer, atardecer y Luna se calculan localmente y contemplan días polares sin inventar horas.
- La detección automática de lavado no se presenta como disponible; el temporizador manual real dura 20 segundos.
- Control remoto usa la cámara del mismo teléfono y guarda las capturas únicamente en Fotos privadas del reloj.

