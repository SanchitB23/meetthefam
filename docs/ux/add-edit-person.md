# Add / edit / link person

A single form covers both add and edit. Linking can happen at creation time (preferred) or after.

## The form

| Field | Required | Notes |
|---|---|---|
| `full_name` | yes | Free text |
| `nickname` | no | Free text |
| `photo` | no | Single avatar; client-resized — see [`../architecture/photo-upload.md`](../architecture/photo-upload.md) |
| `bio` | no | Short free text — multi-line OK |
| `gender` | no | `m / f / other / unknown`; default `unknown`. Used for visual styling only. |
| `birth_year` | no | Integer. "Born around 1955" is fine without a full date. |
| `birth_date` | no | Full date if known. |
| `location` | no | "Where they live now" — free text. |
| `occupation` | no | Free text. |
| `deceased` | no | Toggle. When on, surfaces `death_year`. |
| `death_year` | no | Integer. Hidden until `deceased` is on. |

When opened from the "+" FAB → form is empty.
When opened from a person → form is pre-filled with that person's row + a "Delete" button at the bottom.

Form library: [`react-hook-form`](https://react-hook-form.com/) for validation + state. Submit calls a Server Action; on success, the modal closes and `revalidatePath('/tree/[id]')` re-fetches.

## Linking — at creation time (preferred)

When the "+" FAB is tapped *while focused on a person*, the new-person form has a "How is this person related?" picker pre-pointed at that person. Options:

- **Spouse of `<focus person>`** → on save, sets `spouse_id` symmetrically (with the spouse-symmetry transaction)
- **Parent of `<focus person>`** → on save, sets `<focus person>.father_id` or `.mother_id` based on the new person's gender (or asks if `unknown`)
- **Child of `<focus person>`** → on save, sets the new person's `father_id` or `mother_id` to focus person (and to focus person's spouse if known)

If the "+" FAB is tapped *with no focus person*, the picker offers a person-search dropdown — "Who is this person related to in the tree?" — to attach the new person somewhere.

## Linking — after creation

From a person's "..." menu (long-press or three-dot icon):

- **Set spouse** → opens a person-picker filtered to the current tree. On select, runs the symmetric set-spouse transaction.
- **Set parents** → opens two person-pickers ("Father" and "Mother"). Either or both can be left empty.
- **Add child** → opens the add-person form with `father_id` / `mother_id` pre-filled to the focus person and their spouse (if any).

## Person picker

A searchable list filtered to the current tree's `people`. Search by name + nickname. Each row shows avatar + name + birth year for disambiguation.

Excludes the current person from the list (you can't be your own spouse / parent / child).

## Server Actions involved

| Action | What it does |
|---|---|
| `createPerson(treeId, data, linkSpec?)` | Inserts a `people` row; if `linkSpec` is set, runs the symmetric link transaction in the same DB transaction |
| `updatePerson(personId, data)` | Updates fields on a row; respects RLS (must be owner / editor of the tree) |
| `deletePerson(personId)` | Removes the row + the avatar in Storage; clears any FK references (other rows that pointed to this one as spouse / father / mother get nulled) |
| `setSpouse(personA, personB)` | Sets `A.spouse_id = B`, `B.spouse_id = A`, clears prior spouse on either side. Single transaction. |
| `setParents(personId, fatherId?, motherId?)` | Updates the FKs; runs cycle prevention check |
| `clearSpouse(personId)` | Sets `A.spouse_id = NULL` and clears the partner's `.spouse_id` to NULL |

All actions defined in `app/actions/people.ts` (or similar). All RLS-checked via the user's Supabase client.
