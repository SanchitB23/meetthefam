import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/ui/Prose'

export const metadata: Metadata = {
  title: 'FAQ / Help · meetthefam',
  description:
    'Answers to common questions about meetthefam — how trees work, sharing, photos, privacy, and more.',
}

export default function FaqPage() {
  return (
    <Prose>
      <h1>FAQ / Help</h1>
      <p>
        <strong>Last updated: 2 June 2026</strong>
      </p>

      <h2>Trees &amp; people</h2>

      <h3>What is meetthefam?</h3>
      <p>
        meetthefam is a small, private place to draw your family the way you
        actually know it &mdash; names, faces, a line or two about each person,
        and the simple threads between them: parent, child, partner. It is
        designed for 50 to 200 people and works well on a phone. It is not
        genealogy software: there are no census records, no centuries-deep
        research tools, no power-features for the serious hobbyist. It is for
        the family you already have, the people you could call tomorrow.
      </p>

      <h3>How do I add a family member?</h3>
      <p>
        Open any person&apos;s card on the tree, then tap or click &ldquo;Add
        relative.&rdquo; Choose the relationship &mdash; parent, child, or
        spouse &mdash; fill in the name, and optionally upload a photo and a
        short bio. The person appears on the tree straight away.
      </p>

      <h3>What happens if I delete a person?</h3>
      <p>
        They and their photo are removed immediately. Their relationships are
        removed too, but their relatives stay in the tree. Deletion is permanent
        and cannot be undone from the app.
      </p>

      <h3>Can I import a tree from Ancestry, FamilySearch, or a GEDCOM file?</h3>
      <p>
        Not yet. meetthefam is intentionally lightweight &mdash; the
        &ldquo;meet the family&rdquo; scope, not power-genealogy. GEDCOM import
        is tracked for a future release if there is real demand, but it is not
        on the current roadmap.
      </p>

      <h3>Can I export my tree?</h3>
      <p>
        Export to PDF or image is on the roadmap (v1.2 &mdash; Export &amp;
        archival milestone) and has not shipped yet.
      </p>

      <h2>Sharing &amp; privacy</h2>

      <h3>Who can see my family tree?</h3>
      <p>
        Only you and the editors you invite. Row-level security in the database
        enforces tenant isolation, so no other account can reach your tree&apos;s
        data. The one exception is a read-only share link &mdash; see below.
      </p>

      <h3>How do I share my tree with relatives who do not have an account?</h3>
      <p>
        Go to your tree and generate a share link. Anyone with the link can
        view the tree in read-only mode &mdash; no sign-up required. You can
        revoke the link at any time; the old link stops working immediately.
      </p>

      <h3>Can someone else help me edit my tree?</h3>
      <p>
        Yes. Open the Members sheet on the tree page and invite an editor by
        email. Editors can add and edit people, but cannot delete the tree or
        invite others.
      </p>

      <h2>Photos</h2>

      <h3>How do photos work?</h3>
      <p>
        Photos are resized in your browser before upload, then stored securely
        in cloud storage scoped to your tree. Deleting a person deletes their
        photo too. Photos are accessible only to people who have access to your
        tree (or your share link).
      </p>

      <h2>Account &amp; billing</h2>

      <h3>Is there a mobile app?</h3>
      <p>
        There is no native app in the App Store or Play Store. The web app is
        mobile-first and works well in your phone&apos;s browser. On iOS and
        Android you can add it to your home screen for an app-like feel.
      </p>

      <h3>How much does meetthefam cost?</h3>
      <p>meetthefam is free during the beta period. Pricing is to be determined.</p>

      <h3>How do I delete my account?</h3>
      <p>
        Self-service account deletion is on the roadmap but has not shipped yet.
        In the meantime, email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>{' '}
        and we will delete your account and all associated data.
      </p>

      <h2>Help &amp; legal</h2>

      <h3>Found a bug or have a feature request?</h3>
      <p>
        Email{' '}
        <a href="mailto:hello.mtf@sanchitb23.in">hello.mtf@sanchitb23.in</a>.
        We read every message and aim to reply as soon as we reasonably can.
        Because this is a personal project, please allow a little time for a
        response. You can also reach us through the{' '}
        <Link href="/contact">Contact page</Link>.
      </p>

      <h3>Where can I read the privacy policy and terms of service?</h3>
      <p>
        The <Link href="/privacy">Privacy Policy</Link> covers what data we
        collect and how it is handled. The{' '}
        <Link href="/terms">Terms of Service</Link> set out the ground rules for
        using meetthefam.
      </p>
    </Prose>
  )
}
