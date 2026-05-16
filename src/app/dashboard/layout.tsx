import { SignOutButton } from './SignOutButton'
import { Logo } from '@/components/icons/Logo'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Logo size={28} />
          <span className="font-serif text-xl text-foreground">meetthefam</span>
        </div>
        <SignOutButton />
      </nav>
      {children}
    </div>
  )
}
