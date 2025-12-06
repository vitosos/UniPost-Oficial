import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unipost.cl';

  return {
    rules: {
      userAgent: '*', // Aplica para todos los robots (Google, Bing, etc.)
      allow: '/',     // Permitir ver el Home y páginas públicas
      disallow: [
        '/composer/',  // Bloquear área de trabajo
        '/perfil/',    // Bloquear perfiles privados
        '/equipos/',   // Bloquear gestión de equipos
        '/metricas/',  // Bloquear dashboard de métricas
        '/api/',       // Bloquear endpoints de API
        '/auth/',      // Bloquear rutas de next-auth internas
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`, // Opcional: si generamos sitemap a futuro
  }
}