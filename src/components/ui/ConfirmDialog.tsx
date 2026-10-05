"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Small centred confirmation dialog (native <dialog>, so focus and Esc are handled by the browser). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Not yet",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="rounded-[1.75rem] bg-cream p-6 text-center shadow-lift">
        <h2 id="confirm-dialog-title" className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-mocha">{children}</div>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="h-14 rounded-full bg-espresso font-semibold text-foam shadow-lift transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? "Placing order…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 rounded-full font-semibold text-coffee transition-colors active:bg-oat"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
