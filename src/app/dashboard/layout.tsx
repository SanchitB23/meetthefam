import { SignOutButton } from './SignOutButton'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="font-serif text-xl text-foreground">meetthefam</span>
        <SignOutButton />
      </nav>
      {children}
    </div>
  )
}
