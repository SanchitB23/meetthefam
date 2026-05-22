'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, XCircle, X } from 'lucide-react'

type ErrorAlertProps = {
  message: string
  variant?: 'inline' | 'banner'
  dismissible?: boolean
  action?: ReactNode
  size?: 'sm' | 'default'
}

export function ErrorAlert({
  message,
  variant = 'inline',
  dismissible = false,
  action,
  size = 'default',
}: ErrorAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const Icon = variant === 'banner' ? XCircle : AlertCircle

  const paddingClass = size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--destructive) 12%, var(--background))',
        borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)',
        color: 'var(--foreground)',
      }}
      className={`flex items-start gap-2.5 rounded-md border ${paddingClass} font-sans`}
    >
      <Icon
        size={iconSize}
        aria-hidden="true"
        style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 2 }}
      />
      <span className={`flex-1 leading-snug ${textClass}`}>{message}</span>
      {action && <span className="ml-auto flex-shrink-0">{action}</span>}
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          style={{ color: 'var(--muted-foreground)' }}
          className="ml-auto flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X size={iconSize} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
