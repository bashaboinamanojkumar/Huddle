import type { Metadata, Viewport } from 'next'
import { Inter, Poppins, Lora } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' })
const lora = Lora({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-lora' })

export const metadata: Metadata = {
  title: 'Hudrdle - Connect. Share. Heal Together.',
  description: 'Hudrdle connects UMD students for real conversations, peer support, and mental wellness. Built by students, for students.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1B3A6B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} ${lora.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
