import type { Metadata, Viewport } from 'next'
import { Inter, Poppins, Lora } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { HuddleProvider } from '@/lib/store/huddle-store'
import { RegisterServiceWorker } from '@/components/pwa/register-sw'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' })
const lora = Lora({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-lora' })

export const metadata: Metadata = {
  title: 'Huddle UMD - Small Groups, Real Plans',
  description: 'Huddle helps UMD students find small public activities, RSVP, and coordinate safely from an installable phone-first web app.',
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
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#07080d',
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
      <body className={`${inter.variable} ${poppins.variable} ${lora.variable} font-sans antialiased`}>
        <HuddleProvider>
          {children}
          <RegisterServiceWorker />
          <InstallPrompt />
          <Analytics />
          <Toaster position="top-center" richColors />
        </HuddleProvider>
      </body>
    </html>
  )
}
