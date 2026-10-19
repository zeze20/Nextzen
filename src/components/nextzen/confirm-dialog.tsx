import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(100%-1.5rem,28rem)] max-h-[min(100dvh-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-md bg-card p-5 shadow-[var(--shadow)]">
          <AlertDialog.Title className="text-lg font-medium">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted">{body}</AlertDialog.Description>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className="inline-flex min-h-11 items-center justify-center rounded-sm border border-border px-4 text-sm">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm text-primary-foreground"
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
