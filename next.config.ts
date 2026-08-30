import type { NextConfig } from "next";

const dashboardUrl = process.env.DASHBOARD_URL ?? "https://capy-network.stephenhung.chatgpt.site/app";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: dashboardUrl,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
