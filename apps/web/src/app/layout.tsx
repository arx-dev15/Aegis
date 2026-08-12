import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aegis — AI Engineering OS',
  description: 'Orchestrate AI agents to plan, implement, test, and review code autonomously.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-zinc-950 text-zinc-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
