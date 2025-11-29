# UniPost 🚀

**Plataforma integral de gestión y publicación en redes sociales.**

UniPost es una herramienta web diseñada para optimizar el tiempo de creadores de contenido y equipos, permitiendo la publicación simultánea ("Crossposting"), programación de contenido y análisis de métricas unificadas para Instagram, Facebook, TikTok, Bluesky y muchas más en el futuro.

---

## Características Principales

* **Multi-Cuenta:** Conecta y gestiona múltiples perfiles sociales desde un solo lugar.
* **Composer Inteligente:**
    * Validación de restricciones por red en tiempo real (ej: "TikTok solo permite video").
    * Subida de multimedia (Imágenes y Video).
    * Personalización de texto por cada red social.
* **Scheduler (Programador):** Agenda publicaciones para fechas futuras con precisión de minutos.
* **Métricas Unificadas:**
    * Visualización de Likes, Comentarios y Shares agregados.
    * Análisis de rendimiento de Hashtags.
    * Sincronización automática con APIs externas.
* **Gestión de Equipos:** Roles de usuario, organizaciones y permisos de administración.
* **Seguridad Robusta:** Encriptación AES-256 para todos los tokens de acceso de terceros.

---

## Librerías en Uso

* **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
* **Base de Datos:** [PostgreSQL](https://www.postgresql.org/)
* **ORM:** [Prisma](https://www.prisma.io/)
* **Autenticación:** [NextAuth.js](https://next-auth.js.org/) (v4)
* **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
* **Notificaciones:** [react-hot-toast](https://react-hot-toast.com/)
* **Gráficos:** [Recharts](https://recharts.org/)
* **Utilidades:** `bcrypt` (hashing), `crypto` (encriptación), `sharp` (imágenes).

### Integraciones de API
* **Meta Graph API (v21.0):** Facebook Pages & Instagram Business.
* **TikTok for Developers (V2):** Login Kit & Content Posting API.
* **Bluesky (AT Protocol):** `@atproto/api`.

---

## Instalación y Configuración Local

### 1. Prerrequisitos
* Node.js 18+
* PostgreSQL (Local o en la nube como Neon/Supabase)
