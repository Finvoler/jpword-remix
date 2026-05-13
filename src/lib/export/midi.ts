import { Midi } from "@tonejs/midi";
import { instrumentPresets } from "../../data/instruments";
import type { ScoreProject, VoiceId, VoicePlaybackSettings } from "../../types";

export function buildMidiFile(
  project: ScoreProject,
  selectedVoiceIds: VoiceId[],
  settings: VoicePlaybackSettings,
  bpm: number,
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    measures: 0,
    timeSignature: [project.meta.beatsPerMeasure, project.meta.beatUnit],
  });

  project.voices
    .filter((voice) => selectedVoiceIds.includes(voice.id))
    .forEach((voice) => {
      const track = midi.addTrack();
      const preset = instrumentPresets[settings[voice.id].instrumentId];
      track.name = voice.name;
      track.instrument.number = preset.midiProgram - 1;

      voice.events.forEach((event) => {
        track.addNote({
          midi: event.midi,
          time: event.startBeats,
          duration: event.durationBeats,
          velocity: 0.8,
        });
      });
    });

  return midi.toArray();
}
