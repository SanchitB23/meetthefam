import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'About · meetthefam',
  description:
    'What meetthefam is, who built it, and the heirloom-journal idea behind it.',
}

export default function AboutPage() {
  return (
    <Prose>
      <h1>About meetthefam</h1>
      <p>
        meetthefam is a small, private place to draw your family the way you
        actually know it &mdash; the names, the faces, a line or two about each
        person, and the simple threads between them: parent, child, partner. You
        build a tree, invite a relative or two to help keep it true, and share a
        read-only link with everyone else.
      </p>
      <p>
        It isn&apos;t genealogy software. There are no census records to comb, no
        ancestors to chase back through the centuries, no power-tools for the
        serious hobbyist. It&apos;s for the family you already have &mdash; the
        people you could call tomorrow. The whole thing is meant to feel less
        like a database and more like an heirloom journal passed around the
        room: warm, unhurried, made for the people who already know each other.
      </p>

      <h2>Who built it</h2>
      <p>
        I&apos;m Sanchit Bhatnagar, and I built meetthefam on my own as a
        personal project. I wanted something my own family could open on a phone
        and understand at a glance &mdash; somewhere a cousin&apos;s new baby or a
        grandparent&apos;s old photo could live without getting lost in a group
        chat. The look is deliberate: cream paper, forest green, a quiet serif.
        Closer to a family album than a spreadsheet.
      </p>
      <p>
        Because it&apos;s tended by one person, it stays deliberately small in
        scope. That&apos;s the point, not a limitation.
      </p>

      <h2>Get in touch</h2>
      <p>
        Questions, ideas, or something not working? Email me at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>. For
        how your data is handled, see the <a href="/privacy">Privacy Policy</a>;
        for the ground rules, the <a href="/terms">Terms of Service</a>.
      </p>
    </Prose>
  )
}
