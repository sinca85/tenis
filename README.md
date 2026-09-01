# Tenis Santivillabrile

Panel privado para consultar turnos disponibles de tenis en Neptunia/Brio.

## Desarrollo

1. Copiar `.env.example` a `.env.local` y completar credenciales.
2. Ejecutar `npm install`.
3. Ejecutar `npm run dev` y abrir `http://localhost:3000`.

Sin `.env.local`, el acceso local de desarrollo es `admin` / `tenis`. Para producción es obligatorio definir `ADMIN_USER`, `ADMIN_PASSWORD` y un `SESSION_SECRET` fuerte.

## Despliegue

El proyecto está preparado para desplegarse directamente en Vercel. Configurar las variables de `.env.example` en el proyecto y apuntar `tenis.santivillabrile.com` al deployment de producción.

## Alcance actual

- Login privado con cookie firmada y `httpOnly`.
- Consulta server-side a Brio, sin exponer el ID de socio.
- Login automático en Brio con `USERNAME` y `PASSWORD`.
- Obtención automática de cookie CSRF, `csrfmiddlewaretoken` y `sessionid`.
- `BRIO_TOKEN` como fallback opcional.
- Búsqueda consolidada por fecha y todas las horas configuradas.
- Grilla completa de turnos futuros: disponibles y ocupados.
- Tabla responsive y acceso al portal para reservar.
- Alertas por email cuando un turno ocupado vuelve a estar disponible.

El servidor abre el formulario de Brio, toma un token CSRF fresco, inicia sesión y conserva temporalmente la cookie autenticada. `BRIO_TOKEN` solo se utiliza si el formulario no incluye el token; normalmente puede quedar vacío. La sede, el tipo de servicio, el rango horario, la URL y el socio son constantes internas del proyecto, no variables de entorno. La reserva directa continúa abriendo el portal oficial de Brio.

## Activar alertas

1. Instalar Upstash Redis desde Vercel Marketplace y conectar el proyecto para obtener `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
2. Instalar Resend, verificar `santivillaabrille.com` y configurar `RESEND_API_KEY`.
3. Crear el mismo secreto aleatorio `CRON_SECRET` en Vercel Production y en GitHub Actions (`Settings → Secrets and variables → Actions`).
4. Hacer un nuevo deployment. El workflow `.github/workflows/check-alerts.yml` revisa las bajas cada cinco minutos.
