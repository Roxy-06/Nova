"use client";
import { useCallback, useEffect, useRef } from "react";
import type { FeedPost } from "./types";
export function useVoiceAnnouncer(posts: FeedPost[], enabled: boolean) {
  const latestId = useRef<string | null>(null);
  const speak = useCallback((message: string) => { if (!enabled || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message); utterance.pitch = .9; utterance.rate = 1; utterance.volume = .72; window.speechSynthesis.speak(utterance); }, [enabled]);
  useEffect(() => { const newest = posts[0]; if (!newest) return; if (latestId.current && latestId.current !== newest.id) speak(`New signal logged. Title: ${newest.text.split("\n")[0].slice(0, 120)}. Operational rationale attached.`); latestId.current = newest.id; }, [posts, speak]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return { speak, supported: typeof window !== "undefined" && "speechSynthesis" in window };
}
