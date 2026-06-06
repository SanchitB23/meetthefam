// Shared types for the tree page. Lifted out of `_components/PersonCard.tsx`
// in Phase 4 sub-task 1 so non-card code (FamilyTree, data transform, the
// upcoming detail sheet) can import without pulling card chrome.
import type { Tone } from '@/components/ui/avatar'

// Fields needed across the tree page. Mirrors the columns selected in
// `/tree/[id]/page.tsx`. The card grid is being replaced by family-chart in
// Phase 4 but the shape stays the same — `<FamilyTree>` consumes the rows
// straight from the Server Component, plus the same map is handed to the
// detail sheet (sub-task 3) for relation resolution.
export type PersonRow = {
  id: string
  tree_id: string
  full_name: string
  nickname: string | null
  gender: 'm' | 'f' | 'other' | 'unknown'
  photo_url: string | null
  bio: string | null
  birth_year: number | null
  /** ISO date string 'YYYY-MM-DD'. Present when the user entered a full date. */
  birth_date: string | null
  location: string | null
  occupation: string | null
  deceased: boolean
  death_year: number | null
  father_id: string | null
  mother_id: string | null
  spouse_id: string | null
  tone: Tone
}
