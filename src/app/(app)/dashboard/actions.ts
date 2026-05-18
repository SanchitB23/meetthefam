'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---- Create ----

export type CreateTreeState =
  | { error: string; success?: never }
  | { success: true; treeId: string; error?: never }
  | null

export async function createTree(
  _prevState: CreateTreeState,
  formData: FormData,
): Promise<CreateTreeState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const description =
    (formData.get('description') as string | null)?.trim() || null

  if (!name) return { error: 'Name is required' }
  if (name.length > 80) return { error: 'Name must be 80 characters or fewer' }
  if (description && description.length > 500)
    return { error: 'Description must be 500 characters or fewer' }

  const { data: treeId, error } = await supabase.rpc('create_tree_with_owner', {
    p_name: name,
    p_description: description,
    p_owner_id: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, treeId: treeId as string }
}

// ---- Rename ----

export type RenameTreeState =
  | { error: string; success?: never }
  | { success: true; error?: never }
  | null

export async function renameTree(
  _prevState: RenameTreeState,
  formData: FormData,
): Promise<RenameTreeState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const treeId = formData.get('treeId') as string
  const name = (formData.get('name') as string | null)?.trim() ?? ''

  if (!name) return { error: 'Name is required' }
  if (name.length > 80) return { error: 'Name must be 80 characters or fewer' }

  const { error } = await supabase
    .from('trees')
    .update({ name })
    .eq('id', treeId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// ---- Delete ----

export type DeleteTreeState =
  | { error: string; success?: never }
  | { success: true; error?: never }
  | null

export async function deleteTree(
  _prevState: DeleteTreeState,
  formData: FormData,
): Promise<DeleteTreeState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const treeId = formData.get('treeId') as string

  // Best-effort Storage purge BEFORE the row delete. Once `trees` is gone,
  // `tree_members` cascades away too, which flips `is_tree_editor(treeId)`
  // to false and locks us out of the Storage RLS policies — leaving any
  // surviving objects unreachable. So: list + remove first, then delete.
  // A failure here is logged and ignored; orphans are GC-able later, and
  // the user still gets to delete their tree.
  //
  // Path layout is `trees/<treeId>/people/<personId>/avatar.jpg` — listing
  // one level under `trees/<treeId>/people` gives the personId "folders",
  // each of which holds exactly one avatar.jpg. Folder entries have
  // `id === null` in Supabase Storage listings. v0.1 caps a tree at ~200
  // people, well under the single-call 1000-path limit.
  const { data: personFolders, error: listError } = await supabase.storage
    .from('photos')
    .list(`trees/${treeId}/people`, { limit: 1000 })
  if (listError) {
    console.warn(
      `deleteTree: storage list failed for trees/${treeId}/people: ${listError.message}`,
    )
  } else if (personFolders && personFolders.length > 0) {
    const paths = personFolders
      .filter((entry) => entry.id === null)
      .map((entry) => `trees/${treeId}/people/${entry.name}/avatar.jpg`)
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('photos')
        .remove(paths)
      if (removeError) {
        console.warn(
          `deleteTree: storage remove failed for trees/${treeId}/ (${paths.length} files): ${removeError.message}`,
        )
      }
    }
  }

  const { error } = await supabase
    .from('trees')
    .delete()
    .eq('id', treeId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
