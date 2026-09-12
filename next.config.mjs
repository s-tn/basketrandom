/** @type {import('next').NextConfig} */
const nextConfig = {
    // Single build worker: the prod VPS intermittently OOM-kills parallel build
    // workers, which Next surfaces as "Cannot read properties of undefined (reading 'length')"
    experimental: {
        cpus: 1,
    },
    async rewrites() {
        return [
        ]
      },
      webpack: (config) => {
        config.externals.push('puppeteer', 'puppeteer-core', 'puppeteer-stream', 'discord.js', '@discordjs/voice', 'twitch-stream-video', 'prism-media', 'ws', 'bcryptjs');
        return config;
      }
};

export default nextConfig;
