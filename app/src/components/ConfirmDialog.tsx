import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// 以原生 <dialog> 實作的確認視窗；按 Esc 視同取消
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="m-auto max-w-sm rounded-lg border border-gray-200 p-5 shadow-lg backdrop:bg-black/35"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2 className="mt-0">{title}</h2>
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  )
}
