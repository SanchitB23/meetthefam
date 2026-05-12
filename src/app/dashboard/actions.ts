'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---- Tree mutations ----

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

  const { error } = await supabase
    .from('trees')
    .delete()
    .eq('id', treeId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
