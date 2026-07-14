import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Toaster } from '@/components/ui/sonner'
import { getFrontendUrl } from '@/lib/app-urls'
import './globals.css'

const frontendUrl = getFrontendUrl()

export const metadata: Metadata = {
  metadataBase: frontendUrl ? new URL(frontendUrl) : undefined,
  title: {
    default: 'Acmmo Architects',
    template: '%s | Acmmo Architects',
  },
  description:
    'Manage architecture projects, building permits, and client workflows from intake to handover.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/assets/fav_acmmo.png',
        type: 'image/png',
      },
    ],
    apple: '/assets/fav_acmmo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#147484',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`light ${GeistSans.variable} ${GeistMono.variable} bg-background`}
    >
      <body className="overflow-x-hidden font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
