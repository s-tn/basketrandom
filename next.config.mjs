/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
        ]
      },
      webpack: (config) => {
        config.externals.push('puppeteer', 'puppeteer-stream', 'discord.js', 'twitch-stream-video');
        return config;
      }
};

export default nextConfig;
