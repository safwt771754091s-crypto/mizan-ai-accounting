"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { JournalActionState } from "@/app/actions/journal";

type JournalAction = (state: JournalActionState, formData: FormData) => Promise<JournalActionState>;

export function JournalActionForm({
  action,
  fields,
  label,
  variant = "default",
  withNote,
  notePlaceholder = "ملاحظة",
  noteRequired,
}: {
  action: JournalAction;
  fields: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "danger" | "secondary" | "ghost" | "teal";
  withNote?: boolean;
  notePlaceholder?: string;
  noteRequired?: boolean;
}) {
  const [state, formAction, pending] = useActionState<JournalActionState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {withNote ? (
        <input
          name="note"
          required={noteRequired}
          placeholder={notePlaceholder}
          className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
        />
      ) : null}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "جارٍ..." : label}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
