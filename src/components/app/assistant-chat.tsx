"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  mode?: "local" | "ai";
  fallbackReason?: string | null;
}

const SUGGESTIONS = [
  "ما صافي الربح للفترة؟",
  "ما أكبر المصروفات؟",
  "هل توجد قيود مكررة؟",
  "اعرض الحسابات التي تحتاج إلى مراجعة",
  "اعرض مؤشرات السيولة",
  "قارن الشهر الحالي بالشهر السابق",
  "اشرح قائمة المركز المالي",
  "لماذا انخفض الربح؟",
];

export function AssistantChat({
  companyId,
  companyName,
  currency,
  aiConfigured,
  aiModel,
}: {
  companyId: string;
  companyName: string;
  currency: string;
  aiConfigured: boolean;
  aiModel?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setError(null);
    setInput("");
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, question: trimmed }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        answer?: string;
        sources?: string[];
        mode?: "local" | "ai";
        fallbackReason?: string | null;
      };
      if (!response.ok || !payload.ok || !payload.answer) {
        setError(payload.error ?? "تعذر الحصول على إجابة.");
        return;
      }
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: payload.answer!,
          sources: payload.sources,
          mode: payload.mode,
          fallbackReason: payload.fallbackReason ?? null,
        },
      ]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <Card className="flex min-h-[560px] flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          {!aiConfigured ? (
            <Alert variant="info" title="المساعد يعمل بالإجابة المحسوبة محلياً">
              لم يُضبط مزود ذكاء اصطناعي خارجي. الأسئلة الشائعة تُجاب من محرك التحليل مباشرة بأرقام شركتك، دون إرسال
              بياناتك لأي خدمة خارجية. لإضافة إجابات لغوية مرنة، اضبط متغيرات AI في ملف البيئة.
            </Alert>
          ) : (
            <p className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] leading-5 text-teal-900/85">
              الإجابات تُولَّد عبر {aiModel ?? "مزود AI"} من بيانات هذه الشركة فقط، وتُفحص آلياً قبل العرض: أي رقم غير
              موجود في الحسابات المحسوبة يُرفض ويُستبدل بإجابة محلية.
            </p>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-surface/60 p-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h3 className="text-sm font-bold text-ink">مساعد {companyName} المحاسبي</h3>
                <p className="mt-1 max-w-md text-xs leading-6 text-muted">
                  اسأل عن الأرقام أو النسب أو الملاحظات. كل إجابة مبنية على بيانات هذه الشركة فقط، وتتضمن مصادر الحساب.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === "user" ? "bg-brand-800 text-white" : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-6 ${
                      message.role === "user"
                        ? "bg-brand-800 text-white"
                        : "border border-line bg-white text-ink/85"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === "assistant" ? (
                      <div className="mt-2 border-t border-line pt-2">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={message.mode === "ai" ? "teal" : "neutral"}>
                            {message.mode === "ai" ? "إجابة AI" : "حساب محلي"}
                          </Badge>
                          {message.fallbackReason ? <span className="text-[9px] text-warning-600">{message.fallbackReason}</span> : null}
                        </div>
                        {message.sources?.length ? (
                          <p className="text-[9px] leading-5 text-muted">
                            المصادر: {message.sources.slice(0, 4).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جارٍ تحليل بيانات الشركة...
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div className="rounded-2xl border border-line p-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="اكتب سؤالك المحاسبي... (Enter للإرسال، Shift+Enter لسطر جديد)"
              className="min-h-16 border-0 text-xs focus-visible:ring-0"
              maxLength={600}
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] text-muted" dir="ltr">{input.length}/600</span>
              <Button type="button" size="sm" onClick={() => void send(input)} disabled={loading || input.trim().length < 2}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                إرسال
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-bold text-ink">أسئلة مقترحة</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  disabled={loading}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-muted transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1.5 p-4 text-[10px] leading-5 text-muted">
            <p className="mb-1 text-xs font-bold text-ink">حدود المساعد</p>
            <p>• لا يعدّل أو يحذف أي قيد أو بيانات.</p>
            <p>• لا يصل إلى بيانات شركة أخرى.</p>
            <p>• لا يعتمد القوائم المالية نيابة عنك.</p>
            <p>• الإجابات تحليل مساعد وليست رأياً مهنياً.</p>
            <p>• العملة: {currency} — الفترة الافتراضية: السنة المالية للشركة.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
