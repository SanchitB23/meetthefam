import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'Copyright & Takedown (DMCA) · meetthefam',
  description:
    'How to report copyright infringement on meetthefam and how the notice-and-takedown procedure works.',
}

export default function DmcaPage() {
  return (
    <Prose>
      <h1>Copyright &amp; Takedown Policy</h1>
      <p>
        <strong>Last updated: 31 May 2026</strong>
      </p>
      <p>
        meetthefam (&ldquo;we&rdquo;, &ldquo;us&rdquo;) respects the
        intellectual-property rights of others and expects the people who use
        the Service to do the same. Family trees on meetthefam include
        photographs and written biographies uploaded by users. If you believe
        that content on meetthefam infringes your copyright, this page explains
        how to ask us to remove it, and how the person who posted it can
        respond.
      </p>
      <p>
        meetthefam is operated by Sanchit Bhatnagar (an individual) from India
        and is hosted on infrastructure provided by Vercel and Supabase in the
        United States. The notice-and-takedown procedure below follows the U.S.
        Digital Millennium Copyright Act (DMCA, 17 U.S.C. &sect; 512), adapted
        for a service of this size. Nothing here changes the governing law of
        our <Link href="/terms">Terms of Service</Link>, which remains India.
      </p>

      <h2>1. Reporting copyright infringement</h2>
      <p>
        If you are the copyright owner, or are authorized to act on their
        behalf, send a written notice to our Copyright Contact at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>{' '}
        that includes all of the following:
      </p>
      <ul>
        <li>
          Your name, postal address, telephone number, and email address.
        </li>
        <li>
          A description of the copyrighted work you say has been infringed (for
          example, a specific photograph).
        </li>
        <li>
          Enough detail to let us find the material on meetthefam — the
          share-link URL, the page address, or the name of the person card or
          photo in question.
        </li>
        <li>
          A statement that you have a good-faith belief that the use of the
          material is not authorized by the copyright owner, its agent, or the
          law.
        </li>
        <li>
          A statement that the information in your notice is accurate, and —
          under penalty of perjury — that you are the copyright owner or are
          authorized to act on the owner&apos;s behalf.
        </li>
        <li>Your physical or electronic signature.</li>
      </ul>
      <p>
        Incomplete notices may delay our response, because we may need to come
        back to you for the missing details.
      </p>

      <h2>2. What happens after you send a notice</h2>
      <p>
        When we receive a valid notice, we will remove or disable access to the
        material promptly. Where we can identify the account that posted it, we
        will let that person know and pass on a copy of your notice (which may
        include the contact details you provided) so they understand why their
        content was affected.
      </p>

      <h2>3. Counter-notice</h2>
      <p>
        If your content was removed and you believe it was removed by mistake or
        misidentification — for example, you own the photograph, or your use is
        otherwise lawful — you may send a counter-notice to{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>{' '}
        that includes all of the following:
      </p>
      <ul>
        <li>
          Your name, postal address, telephone number, and email address.
        </li>
        <li>
          Identification of the material that was removed and the location where
          it appeared before it was removed.
        </li>
        <li>
          A statement, under penalty of perjury, that you have a good-faith
          belief the material was removed as a result of a mistake or
          misidentification.
        </li>
        <li>
          A statement that you consent to the jurisdiction of the courts of
          India (consistent with our{' '}
          <Link href="/terms">Terms of Service</Link>) for the purpose of
          resolving the dispute.
        </li>
        <li>Your physical or electronic signature.</li>
      </ul>
      <p>
        If we receive a valid counter-notice, we may restore the removed
        material between 10 and 14 business days after receiving it, unless the
        original complainant notifies us that they have started legal action to
        keep the material down.
      </p>

      <h2>4. Repeat infringers</h2>
      <p>
        We will, in appropriate circumstances and at our discretion, suspend or
        terminate the accounts of users who are repeat infringers.
      </p>

      <h2>5. False claims</h2>
      <p>
        Submitting a notice or counter-notice that misrepresents the facts can
        carry legal liability. Please be sure of your rights before you send
        one. If you are unsure, consider seeking legal advice.
      </p>

      <h2>6. Other jurisdictions</h2>
      <p>
        Because meetthefam is operated from India, complaints may also be raised
        under India&apos;s Information Technology Act, 2000 and the Intermediary
        Guidelines, 2021. Whichever route you use, the Copyright Contact below
        is the right place to start.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will revise
        the &ldquo;Last updated&rdquo; date above.
      </p>

      <h2>8. Contact</h2>
      <p>
        Our Copyright Contact for all takedown and counter-notice matters is{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
