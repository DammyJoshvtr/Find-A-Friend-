import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FAF" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Theme */}
        <meta name="theme-color" content="#0d0d14" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />

        {/* Register service worker */}
        <script dangerouslySetInnerHTML={{ __html: swRegistration }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #0d0d14;
}`;

const swRegistration = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      // When the SW sends SW_UPDATED (triggered by admin push from dashboard),
      // reload the page so users get the new version immediately.
      navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });

      // Fallback: if a new SW takes control without posting a message
      // (e.g. user had the tab open when the update arrived), reload then too.
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (reg.active) window.location.reload();
      });
    });
  });
}`;
