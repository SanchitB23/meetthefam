import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Privacy Policy · meetthefam',
  description:
    'How meetthefam collects, uses, and protects your family-tree data.',
}

export default function PrivacyPage() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        This Privacy Policy explains how meetthefam (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
        and protects your information. meetthefam is operated by Sanchit
        Bhatnagar as an individual. If you have any questions, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>

      <h2>1. Who we are</h2>
      <p>
        meetthefam is a private, invite-based family-tree service operated by
        Sanchit Bhatnagar (an individual) from India. For the purposes of
        applicable data-protection law, including India&apos;s Digital Personal Data
        Protection Act, 2023 (DPDP Act), we act as the data fiduciary for the
        personal data described below.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — the email address you use to sign in
          (via magic link or Google sign-in).
        </li>
        <li>
          <strong>Content you create</strong> — the names, photos, biographies,
          dates, and parent / child / spouse relationships you add to your
          family trees.
        </li>
        <li>
          <strong>Usage data</strong> — minimal, privacy-respecting product
          analytics collected through Vercel Analytics and Vercel Speed Insights
          to understand performance and improve the service.
        </li>
      </ul>
      <p>
        We do not ask for or intentionally collect sensitive personal data
        beyond what you choose to enter into your trees.
      </p>

      <h2>3. Why we use it and our lawful basis</h2>
      <p>
        We process your data to create and maintain your account, store and
        display your family trees, secure your data against unauthorized access,
        and improve the reliability and performance of the service. Our lawful
        basis is your consent (given when you sign up and add content) and our
        legitimate interest in operating and securing the service.
      </p>

      <h2>4. Who we share it with</h2>
      <p>
        We do not sell your personal data. We share it only with the service
        providers (&ldquo;processors&rdquo;) that make meetthefam work:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and photo
          storage.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and analytics.
        </li>
      </ul>
      <p>
        These providers process data on our behalf under their own security and
        privacy commitments. We add new processors only where necessary to run
        the service.
      </p>

      <h2>5. How long we keep it and deletion</h2>
      <p>
        We keep your data for as long as your account and trees exist. You can
        delete individual people or entire trees at any time from within the
        app; doing so removes the associated records and any uploaded photos
        from storage. Account-level export and full-account deletion are planned
        features; until they ship, you can request account deletion by emailing{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a> and
        we will action it.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Subject to applicable law, you have the right to access the personal
        data we hold about you, correct inaccurate data, and request its
        deletion. To exercise these rights, or to raise a grievance, email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>

      <h2>7. Children&apos;s data</h2>
      <p>
        Family trees often include children, including those under 13. The
        relative who adds a child&apos;s information is responsible for any consent
        required under applicable law. See our{' '}
        <a href="/childrens-privacy">Children&apos;s Privacy notice</a>{' '}
        for the full detail, including how to request removal of a
        child&apos;s data.
      </p>

      <h2>8. How we protect your data</h2>
      <p>
        Each family tree is isolated to its owner and invited editors using
        database Row-Level Security, so one account cannot see another&apos;s data.
        Data is encrypted at rest by our storage provider, and read-only share
        links use hashed, unguessable tokens that you can revoke at any time.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will revise
        the &ldquo;Last updated&rdquo; date above. We will communicate material changes
        where appropriate.
      </p>

      <h2>10. Contact</h2>
      <p>
        For any privacy question or request, email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
