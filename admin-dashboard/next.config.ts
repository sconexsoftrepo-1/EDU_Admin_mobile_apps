import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
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
