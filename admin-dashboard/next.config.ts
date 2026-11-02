import type { NextConfig } from "next";
// Browser hardening sent with every page and asset. Camera stays allowed for
// same-origin use (enrollment photo capture); frames are limited to this site.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];
const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The API proxy sets its own Content-Security-Policy (config headers would replace it).
      {
        source: "/:path((?!api/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/colleges-institutions/edunexa-college/portal/:path*",
        destination: "/portal/:path*",
        permanent: true,
      },
      {
        source:
          "/colleges-institutions/edunexa-college/verify-certificate/:path*",
        destination: "/verify-certificate/:path*",
        permanent: true,
      },
      {
        source: "/colleges-institutions/edunexa-college",
        destination: "/portal/login",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
