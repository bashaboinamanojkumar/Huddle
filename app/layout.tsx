import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { HuddleProvider } from '@/lib/store/huddle-store'
import { RegisterServiceWorker } from '@/components/pwa/register-sw'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Huddle - Small Groups, Real Plans',
  description: 'Huddle connects University of Maryland students for real conversations, peer support, and mental wellness. Built by students, for students.',
  applicationName: 'Huddle',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: 'Huddle',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icons/huddle-app-favicon-v1-32.png',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    apple: '/icons/huddle-app-apple-v1-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f1318',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <HuddleProvider>
          {children}
          <RegisterServiceWorker />
          <Analytics />
          <Toaster position="top-center" richColors />
        </HuddleProvider>
      </body>
    </html>
  )
}
