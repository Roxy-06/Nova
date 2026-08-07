"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type RecognitionEvent = Event & { results: { [index: number]: { [index: number]: { transcript: string } } } };
type Recognition = { start(): void; stop(): void; onresult: ((e: RecognitionEvent) => void) | null; onerror: ((e: Event & { error?: string }) => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => Recognition;
declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor; } }
type Props = { enabled: boolean; onToggle(): void; onReadLatest(): void; onToggleTelemetry(): void };
export function AudioAnnouncer({ enabled, onToggle, onReadLatest, onToggleTelemetry }: Props) {
  const recognition = useRef<Recognition | null>(null); const [listening, setListening] = useState(false); const [error, setError] = useState("");
  const listen = useCallback(() => { const Engine = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Engine) return setError("Voice commands are unavailable in this browser."); if (listening) return; const instance = new Engine(); instance.onresult = e => { const command = e.results[0][0].transcript.toLowerCase(); if (command.includes("read latest")) onReadLatest(); if (command.includes("toggle logs")) onToggleTelemetry(); }; instance.onerror = e => setError(e.error === "not-allowed" ? "Microphone permission was denied." : "Voice command could not be processed."); instance.onend = () => setListening(false); recognition.current = instance; setError(""); setListening(true); instance.start(); }, [listening, onReadLatest, onToggleTelemetry]);
  useEffect(() => { const down = (e: KeyboardEvent) => { if (e.code === "Space" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); listen(); } }; const up = (e: KeyboardEvent) => { if (e.code === "Space") recognition.current?.stop(); }; addEventListener("keydown", down); addEventListener("keyup", up); return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); }; }, [listen]);
  return <div className="audio-controls"><button className="audio-toggle" onClick={onToggle}>🔊 AUDIO BROADCAST: {enabled ? "ON" : "OFF"}</button><button className={`mic-toggle ${listening ? "listening" : ""}`} onClick={listen}>◉ MIC</button>{error && <span className="voice-error">{error}</span>}</div>;
}
