"use client";

import { useCallback, useEffect, useState } from "react";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa/environment";
import { INSTALL_POLICY, isSnoozed, shouldShowInstallBanner, snoozeAfterDismiss } from "@/lib/pwa/install-policy";
import { STORAGE_KEYS, readNumber, removeValue, writeValue } from "@/lib/pwa/storage";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

function browserStorage(kind: "local" | "session"): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissCount, setDismissCount] = useState(0);
  const [snoozed, setSnoozed] = useState(false);
  const [shownThisSession, setShownThisSession] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [delayPassed, setDelayPassed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // قراءة بيئة المتصفح بعد الترطيب فقط: التخزين غير متاح على الخادم.
    queueMicrotask(() => {
      if (cancelled) return;
      const local = browserStorage("local");
      const session = browserStorage("session");
      const media = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
      const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;

      setInstalled(readNumber(local, STORAGE_KEYS.installed) === 1);
      setDismissCount(readNumber(local, STORAGE_KEYS.dismissCount) ?? 0);
      setSnoozed(isSnoozed(readNumber(local, STORAGE_KEYS.snoozeUntil), Date.now()));
      setShownThisSession(readNumber(session, STORAGE_KEYS.sessionShown) === 1);
      setStandalone(isStandaloneMode(media, navigatorStandalone));
      setIos(isIosDevice(window.navigator.userAgent, window.navigator.platform));
      setHydrated(true);
      document.documentElement.dataset.installPromptReady = "1";
    });

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      const local = browserStorage("local");
      setInstalled(true);
      setPromptEvent(null);
      writeValue(local, STORAGE_KEYS.installed, "1");
      removeValue(local, STORAGE_KEYS.dismissCount);
      removeValue(local, STORAGE_KEYS.snoozeUntil);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => setDelayPassed(true), INSTALL_POLICY.minDelayMs);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      delete document.documentElement.dataset.installPromptReady;
      window.clearTimeout(timer);
    };
  }, []);

  const promptAvailable = promptEvent !== null;

  const showBanner =
    hydrated &&
    delayPassed &&
    shouldShowInstallBanner({ installed, standalone, promptAvailable, shownThisSession, snoozed, dismissCount });

  /** يُسجَّل في الجلسة فقط دون تغيير حالة العرض، حتى لا تختفي الدعوة لحظة ظهورها. */
  const markShown = useCallback(() => {
    writeValue(browserStorage("session"), STORAGE_KEYS.sessionShown, "1");
  }, []);

  const registerDismissal = useCallback((currentCount: number) => {
    const local = browserStorage("local");
    const nextCount = currentCount + 1;
    const snooze = snoozeAfterDismiss(nextCount);
    setDismissCount(nextCount);
    setSnoozed(true);
    writeValue(local, STORAGE_KEYS.dismissCount, String(nextCount));
    writeValue(local, STORAGE_KEYS.snoozeUntil, String(snooze === null ? Number.MAX_SAFE_INTEGER : Date.now() + snooze));
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!promptEvent) return "unavailable";
    markShown();
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "dismissed") registerDismissal(dismissCount);
    return choice.outcome;
  }, [promptEvent, dismissCount, markShown, registerDismissal]);

  const dismiss = useCallback(() => {
    markShown();
    registerDismissal(dismissCount);
  }, [dismissCount, markShown, registerDismissal]);

  return { hydrated, installed, standalone, ios, promptAvailable, showBanner, install, dismiss, markShown };
}
