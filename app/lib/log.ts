const isDev = process.env.NODE_ENV !== 'production';

export function log(...args: any[]) {
  if (isDev) console.log(...args);
}

export function warn(...args: any[]) {
  console.warn(...args);
}

export function error(...args: any[]) {
  console.error(...args);
}
