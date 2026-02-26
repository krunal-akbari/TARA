import type { NextConfig } from "next";

const apiProxyTargetRaw = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
const apiProxyTarget = apiProxyTargetRaw.endsWith("/")
  ? apiProxyTargetRaw.slice(0, -1)
  : apiProxyTargetRaw;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
