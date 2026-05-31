import type { Metadata } from 'next'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: "Children's Privacy · meetthefam",
  description:
    'How meetthefam handles information about children in family trees, and how to request its removal.',
}

export default function ChildrensPrivacyPage() {
  return (
    <Prose>
      <h1>Children&apos;s Privacy</h1>
      <p>
        <strong>Last updated: 30 May 2026</strong>
      </p>
      <p>
        Family trees naturally include children, sometimes those under 13. This
        notice explains how meetthefam handles information about children and how
        a parent or guardian can have it removed. It supplements our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>1. Who this applies to</h2>
      <p>
        This notice concerns children — including those under 13 — whose
        information a relative chooses to add to a family tree. meetthefam is used
        by the adults who build and maintain trees; it is not directed to
        children, and we do not knowingly let children under 13 create their own
        accounts.
      </p>

      <h2>2. The uploading relative is responsible for consent</h2>
      <p>
        When you add a child&apos;s name, photo, or other details, you confirm that
        you are a parent or a relative entitled to do so, and that you are
        responsible for obtaining any consent required under applicable law. As
        the person adding the information, you decide what is shared and with whom,
        including who receives a read-only share link.
      </p>

      <h2>3. What information about a child may appear</h2>
      <p>
        Only what a relative enters: a name, an optional photo, optional dates such
        as a birth date, an optional short biography, and parent / child / spouse
        relationships. We do not ask for or require any of these about a child.
      </p>

      <h2>4. How we use it</h2>
      <p>
        A child&apos;s information is used only to display the family tree to the
        tree&apos;s owner and the editors they invite. We do not use it for
        advertising, do not build profiles, do not sell it, and do not use it to
        contact the child.
      </p>

      <h2>5. How to have a child&apos;s data removed</h2>
      <p>
        Any editor can delete a person or an entire tree from within the app at any
        time; doing so removes the associated records and any uploaded photos from
        storage. A parent or guardian who is not an editor can email us at{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>{' '}
        to request removal of a child&apos;s data, and we will action it.
      </p>

      <h2>6. How we protect it</h2>
      <p>
        A child&apos;s data sits inside a single tree, isolated to its owner and
        invited editors by database Row-Level Security, and encrypted at rest by
        our storage provider. Read-only share links use hashed, unguessable tokens
        that the owner can revoke at any time.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any question or request about a child&apos;s data, email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
      </p>
    </Prose>
  )
}
