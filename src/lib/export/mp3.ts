import * as Tone from "tone";
import lamejs from "lamejs";
import { createInstrumentSynth, beatToSeconds } from "../audio/playbackEngine";
import type { ScoreProject, VoiceId, VoicePlaybackSettings } from "../../types";

function floatToInt16(value: number): number {
  const sample = Math.max(-1, Math.min(1, value));
  return sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
}

function resolveAudioBuffer(audioSource: AudioBuffer | Tone.ToneAudioBuffer): AudioBuffer {
  if (audioSource instanceof AudioBuffer) {
    return audioSource;
  }

  return (audioSource as unknown as { get: () => AudioBuffer }).get();
}

function encodeMonoMp3(audioSource: AudioBuffer | Tone.ToneAudioBuffer): Blob {
  const audioBuffer = resolveAudioBuffer(audioSource);
  const samples = audioBuffer.getChannelData(0);
  const mono = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    mono[index] = floatToInt16(samples[index]);
  }

  const EncoderCtor = (lamejs as { Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => { encodeBuffer: (input: Int16Array) => Int8Array; flush: () => Int8Array } }).Mp3Encoder;
  const encoder = new EncoderCtor(1, audioBuffer.sampleRate, 128);
  const blockSize = 1152;
  const chunks: ArrayBuffer[] = [];

  for (let start = 0; start < mono.length; start += blockSize) {
    const chunk = mono.subarray(start, start + blockSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) {
      const encodedBytes = Uint8Array.from(encoded);
      chunks.push(encodedBytes.buffer.slice(encodedBytes.byteOffset, encodedBytes.byteOffset + encodedBytes.byteLength));
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
      const tailBytes = Uint8Array.from(tail);
      chunks.push(tailBytes.buffer.slice(tailBytes.byteOffset, tailBytes.byteOffset + tailBytes.byteLength));
  }

  return new Blob(chunks, { type: "audio/mpeg" });
}

export async function renderMp3Blob(
  project: ScoreProject,
  selectedVoiceIds: VoiceId[],
  settings: VoicePlaybackSettings,
  bpm: number,
): Promise<Blob> {
  const selectedVoices = project.voices.filter((voice) => selectedVoiceIds.includes(voice.id));
  if (!selectedVoices.length) {
    throw new Error("请至少选择一个声部再导出 MP3。");
  }

  const durationSeconds = beatToSeconds(project.durationBeats, bpm) + 2;

  const audioBuffer = await Tone.Offline(({ transport }) => {
    selectedVoices.forEach((voice) => {
      const synth = createInstrumentSynth(settings[voice.id].instrumentId).toDestination();
      synth.volume.value = settings[voice.id].volumeDb;
      voice.events.forEach((event) => {
        synth.triggerAttackRelease(
          Tone.Frequency(event.midi, "midi").toFrequency(),
          beatToSeconds(event.durationBeats, bpm),
          beatToSeconds(event.startBeats, bpm),
          0.92,
        );
      });
    });
    // Transport must be started for scheduled events to fire in offline context
    transport.start();
  }, durationSeconds);

  return encodeMonoMp3(audioBuffer);
}
