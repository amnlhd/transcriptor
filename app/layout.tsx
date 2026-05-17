// app/layout.tsx
export const metadata = {
  title: 'Transcriptor',
  description: 'Solution de transcription audio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}