"use client";

import { useActionState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { resetDemoDataAction, type SettingsState } from "@/app/actions/settings";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export function ResetDemoForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(resetDemoDataAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}
      <p className="text-[11px] leading-6 text-muted">
        تعيد هذه العملية بيانات الشركات التجريبية إلى حالتها الأصلية وتمسح أي تعديلات أو استيرادات أجريتها في وضع
        العرض. لا يمكن التراجع.
      </p>
      <Button type="submit" variant="danger" disabled={!enabled || pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        إعادة تعيين بيانات العرض
      </Button>
      {!enabled ? <p className="text-[10px] text-warning-600">متاح لمدير المنصة في وضع العرض التجريبي فقط.</p> : null}
    </form>
  );
}
