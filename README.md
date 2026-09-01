# Tenis Santivillabrile

Panel privado para consultar turnos disponibles de tenis en Neptunia/Brio.

## Desarrollo

1. Copiar `.env.example` a `.env.local` y completar credenciales.
2. Ejecutar `npm install`.
3. Ejecutar `npm run dev` y abrir `http://localhost:3000`.

Sin `.env.local`, el acceso local de desarrollo es `admin@local.test` / `tenis`. Para producción es obligatorio definir `ADMIN_EMAIL`, `ADMIN_PASSWORD` y un `SESSION_SECRET` fuerte.

## Despliegue

El proyecto está preparado para Node/Next.js y salida standalone. Configurar las variables de `.env.example` en el proveedor y apuntar `tenis.santivillabrile.com` al despliegue.

## Alcance actual

- Login privado con cookie firmada y `httpOnly`.
- Consulta server-side a Brio, sin exponer el ID de socio.
- Soporte para la cookie autenticada de Brio mediante `BRIO_COOKIE`.
- Búsqueda consolidada por fecha y todas las horas configuradas.
- Tabla responsive y acceso al portal para reservar.
- Bloque visual preparado para incorporar alertas en la siguiente etapa.

El endpoint de disponibilidad redirige al login cuando no recibe una sesión de Brio. Para probarlo hoy se puede copiar `csrftoken` y `sessionid` de una sesión propia a `BRIO_COOKIE`; para producción conviene automatizar ese login o solicitar una API oficial. La reserva directa y las alertas también requieren estudiar ese flujo autenticado y elegir un canal de aviso (email, Telegram o WhatsApp).
