/**
 * Aufnahme von Sprachnachrichten für den Audio-Modus: der Browser nimmt auf,
 * wir wandeln in WAV um (universell unterstütztes Format bei den Anbietern,
 * unabhängig davon, welchen Container MediaRecorder im jeweiligen Browser
 * liefert) und geben die rohen Bytes direkt an die KI weiter – ohne lokale
 * Transkription. Gerade bei unsicherer Aussprache ist ein Zwischenschritt
 * über Spracherkennung fehleranfälliger als das Original-Audio.
 */

export function canRecordAudio(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface AudioRecorder {
  /** Beendet die Aufnahme und liefert das WAV-Ergebnis (oder null bei leerer Aufnahme). */
  stop(): Promise<RecordedAudio | null>;
  /** Bricht ab, ohne ein Ergebnis zu liefern. */
  cancel(): void;
}

export async function startRecording(): Promise<AudioRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let cancelled = false;

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
  });

  recorder.start();

  const finish = async () => {
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    async stop() {
      await finish();
      if (cancelled || chunks.length === 0) return null;
      const raw = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const wav = await toWav(raw);
      return { blob: wav, mimeType: 'audio/wav', durationMs: Date.now() - startedAt };
    },
    cancel() {
      cancelled = true;
      void finish();
    },
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

async function toWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API wird nicht unterstützt.');
  const ctx = new AudioContextClass();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return encodeWav(audioBuffer);
  } finally {
    void ctx.close();
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

function writeAsciiString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** 16-bit PCM Mono WAV – klein genug für Sprachnachrichten, von jedem Anbieter lesbar. */
function encodeWav(buffer: AudioBuffer): Blob {
  const samples = mixToMono(buffer);
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
