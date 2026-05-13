/**
 * MP3 export — pure Web Audio API rendering, no Tone.js in the render path.
 *
 * Tone.Offline + PolySynth is unreliable (lookahead scheduling conflicts with
 * OfflineAudioContext). OscillatorNode + GainNode is ~200× faster & deterministic.
 *
 * lamejs is loaded via the lamejs-shim (lame.all.js ?raw + new Function) to
 * avoid the "MPEGMode is not defined" bug that appears when Vite bundles the
 * CJS entry src/js/index.js where cross-file globals break.
 */
import { Mp3Encoder } from "./lamejs-shim";
import { beatToSeconds } from "../audio/playbackEngine";
import type { ScoreProject, VoiceId, VoicePlaybackSettings } from "../../types";
import { instrumentPresets } from "../../data/instruments";

// ── helpers ──────────────────────────────────────────────────────────────────

/** MIDI note number → Hz */
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** dB → linear gain (0 dB = 1.0) */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** Float32 sample → Int16 */
function floatToInt16(v: number): number {
  const s = Math.max(-1, Math.min(1, v));
  return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
}

/** Map synthKind to a WebAudio oscillator timbre */
const SYNTH_TO_OSC: Record<string, OscillatorType> = {
  Synth: "triangle",
  AMSynth: "sine",
  FMSynth: "sawtooth",
  DuoSynth: "sine",
};

// ── lamejs encode ─────────────────────────────────────────────────────────────

function encodeToMp3(
  audioBuffer: AudioBuffer,
  onProgress?: (pct: number) => void,
): Blob {
  const samples = audioBuffer.getChannelData(0); // mono
  const n = samples.length;
  const int16 = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    int16[i] = floatToInt16(samples[i]);
  }

  const encoder = new Mp3Encoder(1, audioBuffer.sampleRate, 128);
  const BLOCK = 1152;
  const chunks: ArrayBuffer[] = [];

  for (let start = 0; start < int16.length; start += BLOCK) {
    const slice = int16.subarray(start, start + BLOCK);
    const out = encoder.encodeBuffer(slice);
    if (out.length > 0) {
      const buf = Uint8Array.from(out);
      chunks.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    }
    // report encode progress: 60% → 95%
    if (onProgress) {
      onProgress(60 + Math.floor((start / int16.length) * 35));
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    const buf = Uint8Array.from(tail);
    chunks.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }

  onProgress?.(100);
  return new Blob(chunks, { type: "audio/mpeg" });
}

// ── offline audio render (pure WebAudio) ─────────────────────────────────────

export async function renderMp3Blob(
  project: ScoreProject,
  selectedVoiceIds: VoiceId[],
  settings: VoicePlaybackSettings,
  bpm: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const selectedVoices = project.voices.filter((v) => selectedVoiceIds.includes(v.id));
  if (!selectedVoices.length) {
    throw new Error("请至少选择一个声部再导出 MP3。");
  }

  onProgress?.(5);

  const SAMPLE_RATE = 44100;
  const durationSec = beatToSeconds(project.durationBeats, bpm) + 1.5;
  const numSamples = Math.ceil(durationSec * SAMPLE_RATE);

  // Mono offline context
  const ctx = new OfflineAudioContext(1, numSamples, SAMPLE_RATE);

  // Master gain: prevent clipping
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.72 / Math.max(1, selectedVoices.length);
  masterGain.connect(ctx.destination);

  for (const voice of selectedVoices) {
    const vs = settings[voice.id];
    const voiceGain = dbToLinear(vs.volumeDb);
    const preset = instrumentPresets[vs.instrumentId];
    const oscType = SYNTH_TO_OSC[preset.synthKind] ?? "triangle";

    for (const event of voice.events) {
      const t0 = beatToSeconds(event.startBeats, bpm);
      const dur = Math.max(0.05, beatToSeconds(event.durationBeats, bpm));
      const freq = midiToHz(event.midi);

      const osc = ctx.createOscillator();
      osc.type = oscType;
      osc.frequency.value = freq;

      const env = ctx.createGain();
      const attack = Math.min(0.02, dur * 0.1);
      const release = Math.min(0.15, dur * 0.25);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(voiceGain, t0 + attack);
      env.gain.setValueAtTime(voiceGain * 0.7, t0 + dur - release);
      env.gain.linearRampToValueAtTime(0, t0 + dur);

      osc.connect(env);
      env.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }

  onProgress?.(20);

  const audioBuffer = await ctx.startRendering();

  onProgress?.(60);

  return encodeToMp3(audioBuffer, onProgress);
}

// ── helpers (duplicate section removed) ──────────────────────────────────────
// All helpers are defined above in the new version of this file.
// The old code that follows was left by a partial edit and is not reachable.

