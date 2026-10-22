import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function ConfirmButton({
  children,
  label,
  onConfirm,
  disabled,
}: {
  children: ReactNode
  label?: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [armed, setArmed] = useState(false)

  if (armed) {
    return (
      <button type="button" className="danger" autoFocus disabled={disabled} onClick={onConfirm} onBlur={() => setArmed(false)}>
        {t('common.confirmDelete')}
      </button>
    )
  }
  return (
    <button type="button" className="ghost" aria-label={label} disabled={disabled} onClick={() => setArmed(true)}>
      {children}
    </button>
  )
}
