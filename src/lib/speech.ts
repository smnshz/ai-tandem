/** Sprachausgabe über die Web Speech API – wenn der Browser sie hat. */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  /** Wird aufgerufen, wenn die Wiedergabe zu Ende ist – auch bei Abbruch/Fehler. */
  onEnd?: () => void;
}

export function speak(text: string, lang: string, options: SpeakOptions = {}): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.onend = () => options.onEnd?.();
  // "cancel()" (Interrupt) feuert in den meisten Browsern onerror statt onend.
  utterance.onerror = () => options.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/** Bricht eine laufende (oder wartende) Sprachausgabe sofort ab. */
export function stopSpeaking(): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return canSpeak() && window.speechSynthesis.speaking;
}
