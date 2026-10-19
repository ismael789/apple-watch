# Stripe Test Mode mediante Supabase Edge Functions

## Estado de esta integración

El cliente Expo usa PaymentSheet de Stripe y llama por HTTPS a estas funciones:

- `create-payment-intent`: crea un PaymentIntent de un producto del catálogo fijo.
- `verify-payment-intent`: vuelve a consultar el PaymentIntent directamente en Stripe.
- `stripe-webhook`: valida la firma de Stripe y acepta únicamente eventos relevantes.

No se creó ninguna tabla, cuenta, sistema de registro ni migración a Supabase. El
historial verificado y el intento pendiente siguen guardándose mediante la capa
SQLite local existente.

El servidor `server/server.js` ya no participa en `yarn qr` ni en el flujo de
Wallet. Se conserva únicamente como código heredado y la futura APK no depende
de él ni de una dirección LAN.

## Separación de credenciales

La app móvil solo recibe valores públicos:

```dotenv
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_SUPABASE_URL=https://vftmwgiqxprnlbrkuprk.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Los siguientes valores pertenecen exclusivamente a los secretos de Edge
Functions y nunca deben usar el prefijo `EXPO_PUBLIC_`:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WALLET_ACCESS_TOKEN=valor_aleatorio_de_al_menos_32_caracteres
```

`WALLET_ACCESS_TOKEN` es la protección mínima para esta instalación personal:
se introduce una vez en Wallet y se guarda con `expo-secure-store`. No se
compila dentro de la APK. La clave pública de Supabase por sí sola no autoriza
la creación ni la consulta de pagos.

El valor de Stripe mostrado anteriormente fue indicado como un ejemplo y no se
considera una credencial expuesta. Para desplegar, configura en los secretos de
Supabase la clave de prueba real que decidas utilizar, sin copiarla al cliente
Expo ni incluirla en la APK.

## Configurar secretos sin desplegar código

1. Copia la plantilla ignorada por Git:

```powershell
Copy-Item supabase/functions/.env.example supabase/functions/.env
```

2. Genera una clave personal aleatoria y cópiala al portapapeles:

```powershell
$walletBytes = New-Object byte[] 32
$walletRng = [Security.Cryptography.RandomNumberGenerator]::Create()
$walletRng.GetBytes($walletBytes)
$walletRng.Dispose()
$walletToken = [Convert]::ToBase64String($walletBytes)
Set-Clipboard $walletToken
```

3. Edita `supabase/functions/.env` y coloca la clave Stripe correspondiente,
   el secreto firmado del webhook y el valor recién generado. Ese archivo está
   ignorado.
4. Vincula el proyecto y carga los secretos:

```powershell
npx supabase login
npx supabase link --project-ref vftmwgiqxprnlbrkuprk
npx supabase secrets set --env-file supabase/functions/.env --project-ref vftmwgiqxprnlbrkuprk
npx supabase secrets list --project-ref vftmwgiqxprnlbrkuprk
```

La salida de `secrets list` debe confirmar los nombres, no revelar los valores.

## Despliegue futuro (no ejecutado)

Cuando autorices el despliegue:

```powershell
npx supabase functions deploy create-payment-intent --project-ref vftmwgiqxprnlbrkuprk
npx supabase functions deploy verify-payment-intent --project-ref vftmwgiqxprnlbrkuprk
npx supabase functions deploy stripe-webhook --project-ref vftmwgiqxprnlbrkuprk
npx supabase functions list --project-ref vftmwgiqxprnlbrkuprk
```

Configura en Stripe Test Mode el destino HTTPS:

```text
https://vftmwgiqxprnlbrkuprk.supabase.co/functions/v1/stripe-webhook
```

Suscribe exactamente estos eventos:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

Después de crear el destino, copia su nuevo secreto `whsec_...`, actualiza
`STRIPE_WEBHOOK_SECRET` en `supabase/functions/.env` y repite únicamente
`supabase secrets set`. No hace falta volver a desplegar por cambiar un secreto.

## Ejecución en Expo Go

```powershell
yarn qr --clear
```

Este comando abre solamente Expo/Metro. No inicia Express. Dentro de Wallet,
introduce la misma clave personal guardada como `WALLET_ACCESS_TOKEN`.

Las funciones deben estar desplegadas para que un pago real de prueba funcione.
El código local por sí solo no demuestra conectividad remota.

## Pruebas posteriores al despliegue

Usa únicamente datos de prueba de Stripe:

- Exitoso: `4242 4242 4242 4242`, fecha futura y cualquier CVC de tres dígitos.
- Rechazado: `4000 0000 0000 0002`, fecha futura y cualquier CVC.
- Cancelado por el usuario: abre PaymentSheet y pulsa cerrar o volver sin pagar.

Para cada caso:

1. Selecciona el producto en Wallet y confirma con el botón lateral virtual.
2. Comprueba el mensaje local.
3. Abre Stripe Dashboard en Test Mode y busca el PaymentIntent.
4. Verifica el estado y el evento de webhook correspondiente.
5. Solo un estado `succeeded` debe añadirse al historial SQLite.

El cierre local de PaymentSheet no produce necesariamente un evento
`payment_intent.canceled`: normalmente deja el intento en
`requires_payment_method`. El evento `payment_intent.canceled` aparece cuando
el PaymentIntent se cancela realmente en Stripe.

## Preparación de una APK futura (no ejecutada)

`eas.json` contiene un perfil `preview` con `android.buildType: apk`. Antes de
construir, configura en EAS los tres valores públicos del cliente para el
entorno `preview`:

```powershell
eas login
eas build:configure
eas env:set --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_test_REEMPLAZAR" --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://vftmwgiqxprnlbrkuprk.supabase.co" --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_REEMPLAZAR" --environment preview --visibility plaintext
eas env:list --environment preview
```

Solo después de desplegar y probar las funciones:

```powershell
eas build -p android --profile preview
```

Nunca configures `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, una clave privada
de Supabase ni `WALLET_ACCESS_TOKEN` como variable de EAS/Expo: cualquier valor
incluido en JavaScript debe considerarse público.
