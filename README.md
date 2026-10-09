# reacondicionargdos

Dominio de producción del titular: https://reacondicionargdos.com. Pendiente conectar hosting y DNS. Al desplegar, configurar `APP_URL=https://reacondicionargdos.com`, autorizar `https://reacondicionargdos.com/auth/callback` en Supabase y usar `https://reacondicionargdos.com/api/webhooks/mercadopago` para el webhook.

MVP de un marketplace inverso para vender equipos con fallas o contratar su reparación. Next.js App Router, TypeScript, Tailwind CSS y Supabase. Suscripción técnica: ARS 15.000/mes mediante Mercado Pago. Publicar equipos es gratuito.

## Estado de esta entrega

- Interfaz y servidor implementados: landing, cotizador, feed con filtros, detalle con contacto protegido, acceso por correo, publicación con fotos, cuenta, suscripción/cancelación y administración.
- Migraciones de PostgreSQL y políticas de acceso incluidas. Los contactos se protegen en la base; no se envían al navegador de un visitante sin permisos.
- Sin Supabase configurado, se muestra una vista previa explícita con tres equipos ficticios y un ejemplo de cotización. No se simulan registros, pagos ni publicaciones persistidas.
- Los valores del ejemplo NO son cotizaciones de mercado. No se insertan en la base real.
- No se han conectado cuentas externas ni ejecutado cobros. La prueba integral de Supabase Auth/Storage y Mercado Pago debe completarse antes de habilitar producción.
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
4. En Authentication > URL Configuration, configurar Site URL con la URL real de la web y permitir su `/auth/callback`. Para desarrollo autorizar `http://127.0.0.1:3000/auth/callback` y usar el mismo origen en `APP_URL`.
5. Habilitar Email para los enlaces de acceso. Configurar SMTP propio y sus límites de envío antes de aceptar registros públicos; el servicio de correo predeterminado de Supabase tiene restricciones.
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

- Cuenta/proyecto Supabase, conexión y pruebas reales de Auth/Storage.
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
