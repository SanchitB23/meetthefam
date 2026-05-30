import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Contact · meetthefam',
  description: 'How to reach meetthefam for support, privacy, and other requests.',
}

export default function ContactPage() {
  return (
    <Prose>
      <h1>Contact</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        meetthefam is a personal project built and run by one person. The best
        way to reach us is by email.
      </p>
      <p>
        For support, questions, privacy or data-subject requests, and copyright
        or takedown notices, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
      <p>
        We read every message and aim to respond as soon as we reasonably can.
        Because this is a small personal project, please allow a little time for
        a reply.
      </p>
    </Prose>
  )
}
