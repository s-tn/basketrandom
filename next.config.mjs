/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
        ]
      },
      webpack: (config) => {
        config.externals.push('puppeteer', 'puppeteer-core', 'puppeteer-stream', 'discord.js', '@discordjs/voice', 'twitch-stream-video', 'prism-media', 'ws');
        return config;
      }
};

export default nextConfig;
