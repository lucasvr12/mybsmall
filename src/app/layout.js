import "./globals.css";

export const metadata = {
  title: "Men & Boys - Reservaciones Rápidas",
  description: "Agenda tu cita en nuestras sucursales Men & Boys Barbershop de forma instantánea.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Men & Boys",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#cc0000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#cc0000" />
        <meta name="msapplication-TileColor" content="#cc0000" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />

        {/* Apple / iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Men &amp; Boys" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />

        {/* Android */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Favicon */}
        <link rel="icon" type="image/png" href="/icons/icon-192.png" />
        <link rel="shortcut icon" href="/icons/icon-192.png" />
      </head>
      <body className="font-['Inter',sans-serif] antialiased bg-[#111] text-gray-200 min-h-screen">
        <header className="bg-black/85 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-md mx-auto px-4 h-20 flex items-center justify-center">
            <div className="flex items-center py-2">
              <img src="/logo.jpg" alt="Men & Boys" className="h-14 w-auto object-contain rounded" />
            </div>
          </div>
        </header>
        <main className="w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
