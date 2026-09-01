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
- Login automático en Brio con `USERNAME` y `PASSWORD`.
- Obtención automática de cookie CSRF, `csrfmiddlewaretoken` y `sessionid`.
- `BRIO_TOKEN` como fallback opcional y `BRIO_COOKIE` como alternativa manual.
- Búsqueda consolidada por fecha y todas las horas configuradas.
- Tabla responsive y acceso al portal para reservar.
- Bloque visual preparado para incorporar alertas en la siguiente etapa.

El servidor abre el formulario de Brio, toma un token CSRF fresco, inicia sesión y conserva temporalmente la cookie autenticada. `BRIO_TOKEN` solo se utiliza si el formulario no incluye el token; normalmente puede quedar vacío. También se puede evitar el login automático proporcionando directamente `BRIO_COOKIE`. La reserva directa y las alertas requieren estudiar el endpoint de confirmación y elegir un canal de aviso (email, Telegram o WhatsApp).
