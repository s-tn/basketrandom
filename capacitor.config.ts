const config = {
  appId: 'com.basketrandom.app',
  appName: 'Basket Random',
  webDir: 'out',
  server: {
    // For production, point to the live server so API routes and WebSockets work.
    // Uncomment and set the URL when deploying:
    // url: 'https://your-production-url.com',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
    },
  },
};

export default config;
