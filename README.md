# reacondicionargdos

Dominio de producción del titular: https://reacondicionargdos.com. Pendiente conectar hosting y DNS. Al desplegar, configurar `APP_URL=https://reacondicionargdos.com`, autorizar `https://reacondicionargdos.com/auth/confirm` en Supabase y usar `https://reacondicionargdos.com/api/webhooks/mercadopago` para el webhook.

MVP de un marketplace inverso para vender equipos con fallas o contratar su reparación. Next.js App Router, TypeScript, Tailwind CSS y Supabase. Suscripción técnica: ARS 15.000/mes mediante Mercado Pago. Publicar equipos es gratuito.

## Estado de esta entrega

- Interfaz y servidor implementados: landing, cotizador, feed con filtros, detalle con contacto protegido, acceso por correo, publicación con fotos, cuenta, suscripción/cancelación y administración.
- Migraciones de PostgreSQL y políticas de acceso incluidas. Los contactos se protegen en la base; no se envían al navegador de un visitante sin permisos.
- Sin Supabase configurado, se muestra una vista previa explícita con tres equipos ficticios y un ejemplo de cotización. No se simulan registros, pagos ni publicaciones persistidas.
- Los valores del ejemplo NO son cotizaciones de mercado. No se insertan en la base real.
- Supabase conectado al proyecto `nymvbuhlaaerbgkbtibk`. Migraciones 001–005 aplicadas. Verificados acceso público, bloqueo de contactos anónimos, límite de Storage, bloqueo de cargas directas y token de acceso desde un cliente nuevo. Sin cobros reales ni despliegue todavía.
- Stripe/USDT no están implementados: el titular confirmó que solo tiene cuenta argentina en Mercado Pago. Queda pendiente elegir un proveedor crypto elegible. No se promete USDT en la interfaz.

## Ejecutar

Requiere Node.js 22.18+ (recomendado 24 LTS).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell, reemplazar `cp` por `Copy-Item .env.example .env.local`.

En entornos Windows que bloquean procesos hijos: `npm run dev:portable`. Usa el mismo servidor de Next.js en el proceso actual. La configuración desactiva la CLI separada de TypeScript y usa workers de hilos para permitir comprobaciones dentro de ese entorno. En un equipo sin restricciones se puede usar `npm run dev` normalmente.

```sh
npm run typecheck
npm test
npm run build
npm start
```

La prueba de seguridad ejecuta las migraciones sobre PostgreSQL embebido (PGlite), simula los roles de Supabase y verifica RLS, autorización, contactos, caducidad, reembolsos, idempotencia y firmas. No sustituye la prueba real del proveedor ni la de Storage.

## Conectar Supabase

1. Crear una cuenta y un proyecto propio de Supabase. Elegir la región disponible más cercana a Rosario. Guardar la contraseña de base de datos en un gestor de contraseñas.
2. Ejecutar en SQL Editor, en orden, los archivos de `supabase/migrations/`. Son migraciones iniciales para un proyecto nuevo; no ejecutarlas repetidamente ni sobre un proyecto que ya tenga tablas homónimas sin revisión.
3. Desde la configuración/API del proyecto, copiar la URL pública y la clave publishable a `.env.local`. La clave `SUPABASE_SERVICE_ROLE_KEY` es privada, solo servidor, y nunca debe tener prefijo `NEXT_PUBLIC_`.
4. En Authentication > URL Configuration, configurar Site URL con la URL real de la web y permitir su `/auth/confirm`. Para desarrollo autorizar `http://127.0.0.1:3000/auth/confirm` y usar el mismo origen en `APP_URL`.
5. En Authentication > Emails, copiar `supabase/templates/magic-link.html` a las plantillas Magic Link y Confirm signup. El enlace usa TokenHash y `/auth/confirm`; un POST explícito lo consume sin depender de cookies PKCE de otro dispositivo. Mantener habilitado Email para los enlaces de acceso. Configurar SMTP propio y sus límites de envío antes de aceptar registros públicos; el servicio de correo predeterminado de Supabase tiene restricciones.
6. Registrar tu cuenta usando el formulario de la aplicación. Obtener su UUID en Authentication > Users y ejecutar, desde SQL Editor: `update public.users set role = 'admin' where id = 'UUID_DE_TU_USUARIO';`. Nunca habilitar la elección de admin en el registro público.
7. Ingresar en `/admin` para cargar publicaciones autorizadas y `/admin/cotizador` para agregar valores reales. No se necesitan cuentas ficticias para los titulares de las publicaciones manuales.

Las tablas públicas tienen RLS y permisos mínimos. Las escrituras de publicaciones pasan por funciones transaccionales que validan identidad, Rosario y autorización. Las imágenes son públicas: no subir fotos de documentos, conversaciones, contactos o ubicaciones privadas. Las capturas provenientes de Marketplace deben revisarse antes de subirlas.

## Conectar Mercado Pago

1. En Mercado Pago Developers > Tus integraciones, crear/configurar una aplicación propia para suscripciones y obtener sus credenciales. Guardarlas solo en variables de entorno del servidor.
2. Configurar la URL HTTPS final en `APP_URL`.
3. Configurar el webhook `https://TU_DOMINIO/api/webhooks/mercadopago` para los eventos `subscription_preapproval`, `subscription_authorized_payment` y `payment`.
4. Guardar el Access Token y la clave secreta de Webhooks en `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`.
5. Completar una suscripción con las cuentas/medios de prueba que indique Mercado Pago. Verificar aprobación, renovación, cancelación, duplicados y reversión. El código debe recibir un cobro aprobado, no solamente una suscripción autorizada.
6. Activar `PAYMENTS_ENABLED=true` en el ambiente de prueba para el ensayo y, después de aprobarlo, en producción con las credenciales correspondientes. Esta bandera está desactivada por defecto.

La creación de la suscripción envía el importe desde servidor. No acepta un precio del navegador. Se conserva el identificador externo y una clave de idempotencia estable. Una sola suscripción pendiente/activa por técnico evita múltiples procesos de cobro. El webhook valida firma, identificador y vigencia, vuelve a consultar al proveedor y verifica importe, moneda y vínculo con la factura. La actualización del acceso se realiza en una transacción de base de datos.

El botón «Actualizar estado del pago» permite reconciliar un cobro cuya notificación se haya retrasado. Cancelar la renovación la cancela primero en Mercado Pago y después actualiza la base. Los períodos pagados permanecen utilizables hasta su vencimiento. Un reembolso o contracargo invalida el período correspondiente. Los huecos entre períodos no conceden acceso.

## Despliegue

El proyecto es Next.js estándar y admite Vercel u otro hosting Node compatible. No depende de Vinext, D1 ni de una cuenta OpenAI para los usuarios finales.

1. Crear o seleccionar el hosting del titular y revisar su plan para uso comercial.
2. Desplegar el directorio de este proyecto con build `npm run build`.
3. Configurar las variables de `.env.example` en el hosting. Nunca subir `.env.local` al repositorio.
4. Ajustar `APP_URL`, los redirects de Supabase y el webhook de Mercado Pago al dominio definitivo.
5. Ejecutar la prueba integral antes de abrir registros y cobros públicos.

Vercel Hobby se destina a proyectos personales no comerciales; revisar Pro u otra alternativa autorizada para este negocio. Esta entrega no contrata servicios pagos ni crea cuentas en nombre del usuario.

## Pendientes de lanzamiento

- SMTP propio y prueba de entrega del correo de acceso; prueba de la interfaz de publicación con seis fotos.
- Cuenta de hosting y despliegue HTTPS.
- Credenciales de Mercado Pago y prueba completa con sus cuentas de prueba.
- Datos del responsable y canal real de atención/privacidad para completar las condiciones.
- Rangos de precios verificados para el cotizador y publicaciones con autorización.
- Proveedor compatible para USDT si se mantiene ese requisito.

Limitaciones deliberadas: el feed carga las 90 publicaciones activas más recientes y filtra ese conjunto; administración muestra las 100 más recientes. Ampliar con paginación al acercarse a esos volúmenes. No hay chat, carrito, logística, escrow ni pagos entre clientes y técnicos. El MVP restringe la localidad declarada a Rosario; no verifica residencia física.

## Documentación oficial consultada

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Mercado Pago Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/overview)
- [Mercado Pago Webhooks](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- [Stripe: disponibilidad](https://stripe.com/global)

## Protección de imágenes y contactos

- Hasta seis fotos por publicación. El navegador las reduce a 1600 px (lado mayor) y 2 MiB; se envían individualmente para respetar los límites del hosting.
- El servidor decodifica y vuelve a generar WebP, eliminando EXIF/GPS. Storage limita cada archivo a 2 MiB; las cargas directas de usuarios están revocadas para impedir saltarse el procesamiento.
- Los técnicos no pueden consultar la tabla de contactos directamente. La función reveal_contact verifica suscripción y estado, y permite 30 contactos distintos en una ventana móvil de 24 horas. La cuota se serializa por usuario para impedir carreras.
- El acceso del dueño y del administrador se conserva. Un contacto ya consultado vuelve a requerir suscripción vigente; cerrar la publicación bloquea nuevas consultas del técnico.
- Los límites reducen la extracción masiva; no impiden copiar un contacto obtenido legítimamente ni el uso coordinado de varias cuentas.
- Las cargas que no terminan en una publicación pueden dejar fotos huérfanas; antes del lanzamiento, definir su limpieza y la política de conservación.

## Estado verificado el 9 de octubre de 2026

- Build de producción y TypeScript correctos; 40 verificaciones de seguridad/cobros y pruebas de fotos correctas.
- En Supabase real: Storage rechaza más de 2 MiB, bloquea uploads directos, acepta WebP saneado; token válido desde cliente nuevo y rechazado al reutilizarlo; cuenta sin pago no accede a contactos. La cuenta y foto de ensayo fueron eliminadas y no se enviaron correos.
- El flujo con TokenHash está implementado y probado a nivel de Auth. Activarlo en los correos requiere configurar SMTP o Pro: el panel actual no permite editar las plantillas sin uno de ellos. Mientras tanto sigue funcionando el callback PKCE para el navegador original.
- Vercel y Mercado Pago quedaron bloqueados por permisos guardados del navegador. No se desplegó, no se eliminó el sitio viejo y no hubo cobros.
- Pendientes: responsable/correo de privacidad, política y limpieza de fotos abandonadas, SMTP, prueba UI completa, alertas de publicaciones, despliegue y ensayo de pago real.
