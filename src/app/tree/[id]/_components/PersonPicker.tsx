'use client'

import { useMemo } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Avatar } from '@/components/ui/avatar'
import { Memoriam } from '@/components/ui/memoriam'
import { useIsDesktop } from '@/components/ui/use-is-desktop'

import type { PersonRow } from '../_lib/types'

// Phase 3 sub-task 4 — searchable person selector.
//
// PersonPicker is dumb on purpose: it accepts a pre-computed
// `excludeIds` set so the caller (PersonCardMenu / SetParentsDialog)
// owns the relation-walk logic. That keeps the picker reusable for
// spouse / parent / future "Add relative" flows.
//
// Filtering: `cmdk` matches against the `value` prop on each
// `CommandItem`. We set `value` to `${full_name} ${nickname}` lowercased
// so the built-in fuzzy match covers both fields without any custom
// filter function. (cmdk's default filter is case-insensitive subsequence
// matching — see https://github.com/pacocoursey/cmdk#filtering.)
//
// Footer error slot: callers (e.g. `SetParentsDialog`) sometimes need
// to render an inline error returned by the linking RPC. We expose it
// via `footer` rather than hard-coding an `error` prop so the dialog
// can also drop in a Save button alongside the error message.

export type PersonPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** All people in the tree (passed in from PersonList — no extra fetch). */
  people: PersonRow[]
  /** IDs to hide from the list — self, plus relation-specific guards. */
  excludeIds: Iterable<string>
  /** Header copy, e.g. "Set spouse" or "Set father". */
  title: string
  description?: string
  /** Called when the user picks someone. Picker stays open; caller decides whether to close. */
  onSelect: (personId: string) => void
  /** Optional footer (e.g. inline error + Save button for the parents dialog). */
  footer?: React.ReactNode
}

function PickerBody({
  people,
  excludeIds,
  onSelect,
}: Pick<PersonPickerProps, 'people' | 'excludeIds' | 'onSelect'>) {
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds])
  const visiblePeople = useMemo(
    () => people.filter((p) => !excludeSet.has(p.id)),
    [people, excludeSet],
  )

  return (
    <Command className="bg-transparent">
      <CommandInput placeholder="Search by name or nickname…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {visiblePeople.map((p) => {
          // cmdk's default filter compares against `value` (case-insensitive).
          // We include nickname so a search for "Janie" finds "Jane Smith".
          const value = `${p.full_name} ${p.nickname ?? ''}`.toLowerCase()
          return (
            <CommandItem
              key={p.id}
              value={value}
              onSelect={() => onSelect(p.id)}
              className="cursor-pointer"
            >
              <Avatar
                fullName={p.full_name}
                photoUrl={p.photo_url}
                tone={p.tone}
                size="sm"
                gender={p.gender}
                deceased={p.deceased}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground">
                  {p.deceased ? (
                    <Memoriam name={p.full_name} />
                  ) : (
                    p.full_name
                  )}
                  {p.nickname && (
                    <span className="ml-1 text-foreground/50 italic font-normal">
                      “{p.nickname}”
                    </span>
                  )}
                </span>
                {p.birth_year && (
                  <span className="text-xs text-foreground/50">
                    b. {p.birth_year}
                  </span>
                )}
              </div>
            </CommandItem>
          )
        })}
      </CommandList>
    </Command>
  )
}

export function PersonPicker({
  open,
  onOpenChange,
  people,
  excludeIds,
  title,
  description,
  onSelect,
  footer,
}: PersonPickerProps) {
  const desktop = useIsDesktop()

  const body = (
    <div className="flex flex-col gap-3 px-4 pb-4 sm:px-0 sm:pb-0">
      <PickerBody
        people={people}
        excludeIds={excludeIds}
        onSelect={onSelect}
      />
      {footer}
    </div>
  )

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">{body}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] flex flex-col rounded-t-xl"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="font-serif text-xl">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{body}</div>
      </SheetContent>
    </Sheet>
  )
}
