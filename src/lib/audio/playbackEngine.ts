import * as Tone from "tone";
import { instrumentPresets } from "../../data/instruments";
import type { InstrumentId, ScoreProject, VoiceId, VoicePlaybackSettings } from "../../types";

const synthKinds = {
  Synth: Tone.Synth,
  AMSynth: Tone.AMSynth,
  FMSynth: Tone.FMSynth,
  DuoSynth: Tone.DuoSynth,
};

let activeSynths: Tone.PolySynth[] = [];
let activeParts: Tone.Part[] = [];

export function beatToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm);
}

export function createInstrumentSynth(instrumentId: InstrumentId): Tone.PolySynth {
  const preset = instrumentPresets[instrumentId];
  const SynthCtor = synthKinds[preset.synthKind];
  return new Tone.PolySynth(SynthCtor as never, preset.options as never);
}

function disposeActiveNodes(): void {
  activeParts.forEach((part) => part.dispose());
  activeSynths.forEach((synth) => {
    synth.releaseAll();
    synth.dispose();
  });
  activeParts = [];
  activeSynths = [];
}

function loadPlayback(project: ScoreProject, selectedVoiceIds: VoiceId[], settings: VoicePlaybackSettings, bpm: number): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.seconds = 0;
  transport.bpm.value = bpm;
  disposeActiveNodes();

  project.voices
    .filter((voice) => selectedVoiceIds.includes(voice.id))
    .forEach((voice) => {
      const synth = createInstrumentSynth(settings[voice.id].instrumentId).toDestination();
      synth.volume.value = settings[voice.id].volumeDb;

      const part = new Tone.Part((time, event) => {
        const note = event as { midi: number; durationBeats: number };
        synth.triggerAttackRelease(
          Tone.Frequency(note.midi, "midi").toFrequency(),
          beatToSeconds(note.durationBeats, bpm),
          time,
          0.92,
        );
      }, voice.events.map((event) => [beatToSeconds(event.startBeats, bpm), event]));

      part.start(0);
      activeSynths.push(synth);
      activeParts.push(part);
    });
}

export async function playProjectSelection(
  project: ScoreProject,
  selectedVoiceIds: VoiceId[],
  settings: VoicePlaybackSettings,
  startBeat: number,
  bpm: number,
): Promise<void> {
  if (!selectedVoiceIds.length) {
    return;
  }

  await Tone.start();
  loadPlayback(project, selectedVoiceIds, settings, bpm);
  Tone.getTransport().start("+0.02", beatToSeconds(startBeat, bpm));
}

export function pausePlayback(): void {
  Tone.getTransport().pause();
  activeSynths.forEach((synth) => synth.releaseAll());
}

export function stopPlayback(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.seconds = 0;
  disposeActiveNodes();
}

export function seekPlayback(project: ScoreProject, targetBeat: number, bpm: number, keepPlaying: boolean): void {
  const transport = Tone.getTransport();
  const offsetSeconds = beatToSeconds(targetBeat, bpm);

  if (keepPlaying) {
    transport.stop();
    transport.start("+0.02", offsetSeconds);
    return;
  }

  transport.pause();
  activeSynths.forEach((synth) => synth.releaseAll());
  transport.seconds = offsetSeconds;
}

export function getPlaybackPositionBeats(project: ScoreProject, bpm: number): number {
  return Tone.getTransport().seconds / (60 / bpm);
}

export function isPlaybackRunning(): boolean {
  return Tone.getTransport().state === "started";
}

export function disposePlayback(): void {
  stopPlayback();
  Tone.getTransport().cancel();
  disposeActiveNodes();
}
