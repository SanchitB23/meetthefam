import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Terms of Service · meetthefam',
  description: 'The terms that govern your use of meetthefam.',
}

export default function TermsPage() {
  return (
    <Prose>
      <h1>Terms of Service</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        These Terms of Service ("Terms") govern your use of meetthefam ("the
        Service"), operated by Sanchit Bhatnagar (an individual). By using the
        Service, you agree to these Terms.
      </p>

      <h2>1. Acceptance and eligibility</h2>
      <p>
        By creating an account or using the Service, you confirm that you can
        form a binding contract and that you will comply with these Terms. If
        you do not agree, do not use the Service.
      </p>

      <h2>2. The service</h2>
      <p>
        meetthefam lets you build private family trees, invite editors, and
        share read-only views with relatives. The Service is provided on an "as
        is" and "as available" basis. We do not guarantee that it will always be
        available, uninterrupted, or error-free, and we may change or
        discontinue features.
      </p>

      <h2>3. Your content and licence</h2>
      <p>
        You retain ownership of everything you add to the Service — names,
        photos, biographies, and relationships ("Your Content"). You grant us a
        limited, non-exclusive licence to store, process, and display Your
        Content solely to operate and provide the Service to you and the people
        you share it with. We claim no ownership of Your Content.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You are responsible for Your Content and for the people with whom you
        share read-only links. You agree not to upload unlawful, infringing, or
        harmful content, not to add another person's information without a
        legitimate family or personal reason, and not to misuse, disrupt, or
        attempt to gain unauthorized access to the Service.
      </p>

      <h2>5. Disclaimers and limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the Service is provided without
        warranties of any kind. We are not liable for any indirect, incidental,
        or consequential damages, or for loss of data, arising from your use of
        the Service. Our total liability is limited to the amount you have paid
        us, if any, in the twelve months before the claim.
      </p>

      <h2>6. Termination</h2>
      <p>
        You may stop using the Service at any time and delete your trees. We may
        suspend or terminate access if you breach these Terms or to protect the
        Service. On termination, we will delete or anonymize your data in line
        with our Privacy Policy.
      </p>

      <h2>7. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, and the courts of India
        will have exclusive jurisdiction over any dispute arising from them.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will revise
        the "Last updated" date above. Continued use of the Service after
        changes means you accept the updated Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
