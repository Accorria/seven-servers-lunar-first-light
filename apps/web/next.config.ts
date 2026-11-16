/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/navigator", destination: "/mission", permanent: false },
    ];
  },
};

export default nextConfig;
