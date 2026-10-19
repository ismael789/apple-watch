# Almacenamiento Android de Watch Home

## Identidad y alcance

- Identificador configurado para la futura aplicación Android: `com.ismael.watchhome`.
- Expo Go usa el paquete nativo de Expo Go. Sus archivos de desarrollo no se
  transfieren automáticamente a la APK.
- La APK todavía no se ha creado ni se ha verificado en un teléfono.

## Implementación actual

`expo-file-system` escribe fotografías, música y descargas en el directorio
persistente privado que Android asigna a la aplicación. Nunca se construyen rutas
absolutas manualmente. El caché administrado se mantiene separado y no contiene
datos que deban sobrevivir.

Las importaciones primero se copian, después se comprueban físicamente y sólo
entonces se registran. El borrado rechaza cualquier URI que no pertenezca a los
directorios administrados. Los originales elegidos con los selectores de Android
no se modifican.

## `Android/data/<applicationId>/files/`

Android expone este directorio externo específico mediante
`Context.getExternalFilesDir()`. No necesita permisos generales de almacenamiento
en Android 4.4 o posterior y Android lo elimina al desinstalar la aplicación.

Expo FileSystem no expone una API documentada para seleccionar
`getExternalFilesDir()`. El módulo Android local `WatchStorage` obtiene esa ruta
directamente desde `Context`, comprueba que el volumen esté montado y crea en el
primer arranque las subcarpetas `photos`, `music`, `downloads` y `other`. La APK
utilizará esas URI para sus archivos ordinarios. Si el volumen externo no está
disponible, se conserva el almacenamiento interno como respaldo seguro. Expo Go no
incluye el módulo y continúa usando su propio `documentDirectory`.

## `Android/obb/<applicationId>/`

Android expone el directorio correcto mediante `Context.getObbDir()`. El módulo
nativo consulta la ruta, el estado del volumen y si el directorio existe. Está
pensado para archivos de expansión OBB y puede no existir si la aplicación no tiene
uno. Este proyecto no necesita expansiones, así que deliberadamente no llama
`mkdirs()`, no crea archivos y no lo usa para fotos, música, bases de datos o
descargas. La existencia real sólo podrá confirmarse en la futura APK instalada.

## Desinstalación y restauración

`android.allowBackup` está desactivado. El complemento `withNoDataRestore` también
genera exclusiones para Auto Backup y transferencia entre dispositivos en Android
11 y anteriores y en Android 12 o posterior. Estas reglas sólo se materializan en
el manifiesto y recursos nativos cuando se genere una aplicación independiente.

## Validaciones físicas pendientes

En la futura APK se debe verificar el `applicationId`, inspeccionar las rutas
devueltas por Android, importar un MP3, capturar una foto, probar sin conexión,
reiniciar, comparar tamaños antes y después, desinstalar y confirmar que los
originales personales permanecen intactos. No se declara validado ninguno de esos
puntos hasta realizar la prueba en Android.

Referencias oficiales:

- https://developer.android.com/training/data-storage/app-specific
- https://developer.android.com/reference/android/content/Context#getObbDir()
- https://developer.android.com/google/play/expansion-files
- https://developer.android.com/identity/data/autobackup
- https://docs.expo.dev/versions/latest/sdk/filesystem/
