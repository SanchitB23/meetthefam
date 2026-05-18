import { Branch } from '@/components/icons/Branch'
import { Leaf } from '@/components/icons/Leaf'
import { Family } from '@/components/icons/Family'
import { Heart } from '@/components/icons/Heart'

const features = [
  {
    Icon: Family,
    title: 'Your people, your way',
    body: 'Parents, children, spouses. Names + photos + bios. No genealogy-spreadsheet vibe.',
  },
  {
    Icon: Heart,
    title: 'A keepsake for shared moments',
    body: 'Send a read-only link to relatives. No accounts needed — just the people in your tree.',
  },
  {
    Icon: Leaf,
    title: 'Made for phones',
    body: 'Pan, pinch, tap-to-add. Built mobile-first so the family group chat actually uses it.',
  },
]

export function LandingFeatures() {
  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <Branch className="text-foreground/30 mx-auto mb-6" />
        <h2 className="font-serif text-3xl text-foreground">
          <Leaf size={24} className="inline mr-2 text-primary" />
          What you get
        </h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {features.map(({ Icon, title, body }) => (
          <div key={title} className="text-center">
            <Icon size={32} className="text-accent mx-auto mb-4" />
            <h3 className="font-serif text-xl text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <Branch flip className="text-foreground/30 mx-auto mt-12" />
    </section>
  )
}
