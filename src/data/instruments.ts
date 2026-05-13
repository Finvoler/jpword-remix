import { InstrumentId, type InstrumentPreset } from "../types";

export const instrumentPresets: Record<InstrumentId, InstrumentPreset> = {
  [InstrumentId.BrightPiano]: {
    id: InstrumentId.BrightPiano,
    label: "亮音钢琴",
    midiProgram: 1,
    synthKind: "Synth",
    options: {
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.4, release: 0.9 },
    },
  },
  [InstrumentId.WarmPad]: {
    id: InstrumentId.WarmPad,
    label: "暖垫弦乐",
    midiProgram: 89,
    synthKind: "AMSynth",
    options: {
      harmonicity: 1.8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.12, decay: 0.2, sustain: 0.82, release: 1.8 },
      modulation: { type: "triangle" },
      modulationEnvelope: { attack: 0.15, decay: 0.3, sustain: 0.75, release: 1.5 },
    },
  },
  [InstrumentId.ReedOrgan]: {
    id: InstrumentId.ReedOrgan,
    label: "簧风琴",
    midiProgram: 20,
    synthKind: "FMSynth",
    options: {
      harmonicity: 2,
      modulationIndex: 5,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 1.1 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.03, decay: 0.2, sustain: 0.55, release: 0.8 },
    },
  },
  [InstrumentId.CrystalBell]: {
    id: InstrumentId.CrystalBell,
    label: "晶体钟琴",
    midiProgram: 10,
    synthKind: "DuoSynth",
    options: {
      vibratoAmount: 0.2,
      vibratoRate: 5,
      harmonicity: 1.5,
      voice0: { oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.8 } },
      voice1: { oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.9 } },
    },
  },
  [InstrumentId.VelvetLead]: {
    id: InstrumentId.VelvetLead,
    label: "丝绒主音",
    midiProgram: 82,
    synthKind: "Synth",
    options: {
      oscillator: { type: "fatsawtooth" },
      envelope: { attack: 0.01, decay: 0.14, sustain: 0.58, release: 0.65 },
    },
  },
};

export const instrumentOptions = Object.values(instrumentPresets);
