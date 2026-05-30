import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return value ? new URL(value).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const imageRemotePatterns = supabaseHost && !supabaseHost.includes('preview.supabase.co')
  ? [{ protocol: 'https' as const, hostname: supabaseHost }]
  : [];

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://aframe.io https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' blob: https://*.supabase.co https://*.sentry.io https://*.upstash.io https://cdn.jsdelivr.net",
      "media-src 'self' blob: https://*.supabase.co",
      "worker-src 'self' blob:",
      "manifest-src 'self'"
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  output: 'standalone',
  images: { remotePatterns: imageRemotePatterns },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default nextConfig;
