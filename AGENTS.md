# Reglas permanentes del simulador Watch Home

Estas reglas se aplican a cualquier cambio futuro del repositorio.

## Identidad y protección del menú

- La cuadrícula interactiva de burbujas es la pantalla inicial y la identidad
  principal del proyecto. No eliminarla, ocultarla, sustituirla ni rediseñar
  su distribución tipo panal sin autorización expresa.
- No modificar `Bubble.js`, `WineGlass.js`, `PanView.js`, sus coordenadas,
  dimensiones o animaciones para resolver problemas ajenos al menú.
- Ningún panel invisible puede permanecer montado sobre las burbujas capturando
  gestos. Notificaciones y Pila inteligente pertenecen solamente a la carátula.
- Conservar la secuencia de la corona: aplicación → burbujas → carátula →
  burbujas. Mantener también el botón lateral, Dock y vista de lista.
- No eliminar aplicaciones, juegos, datos persistentes, integraciones ni
  módulos existentes para simplificar una tarea local.

## Procedimiento para cambios

1. Inspeccionar los componentes y consumidores afectados antes de editar.
2. Si existe Git, crear un punto de recuperación sin credenciales ni `.env`.
3. Hacer el cambio mínimo y aislar las capas o gestos nuevos.
4. Confirmar que `WATCH_APPS` conserva identificadores únicos e iconos válidos.
5. Ejecutar ESLint, todas las pruebas y las regresiones de burbujas/navegación.
6. Para cambios visuales o gestuales, comprobar también en Expo Go o emulador;
   una prueba unitaria no equivale a una verificación física.
7. Documentar toda validación pendiente de una APK o dispositivo real.

## Expo Go y futura APK

- Mantener Expo SDK 57 y la compatibilidad con Expo Go donde sea posible.
- Cargar capacidades nativas opcionales sin provocar errores por módulos
  ausentes. No afirmar que una función nativa fue probada solo porque compiló.
- No generar APK sin autorización expresa.
- No usar datos físicos falsos como si fueran mediciones reales.
- Conservar `MusicProvider`, SQLite, `storageManager`, `WatchStorageModule`, el
  almacenamiento privado, Android/data y la consulta legítima de Android/obb.

## Fidelidad y propiedad intelectual

- Agregar solamente funciones existentes en Apple Watch/watchOS o alternativas
  Android claramente fundamentadas.
- Usar iconos y recursos propios o con licencia apropiada. No copiar recursos
  internos de Apple ni presentar el proyecto como producto oficial.

