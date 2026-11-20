import type { NextConfig } from "next";

// Cabeceras de seguridad aplicadas a todas las respuestas.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Los archivos subidos nunca deben ejecutarse como documento.
      { source: "/uploads/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; media-src 'self'; sandbox" }] },
    ];
  },
};

export default nextConfig;
