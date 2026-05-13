const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const;

const TONIC_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function tonicToMidiRoot(tonic: string): number {
  const semitone = TONIC_TO_SEMITONE[tonic] ?? 0;
  return 60 + semitone;
}

export function tokenToMidi(tonic: string, tokenCore: string): number | null {
  const digitMatch = tokenCore.match(/[0-7]/);
  if (!digitMatch) {
    return null;
  }

  const degree = Number(digitMatch[0]);
  if (degree === 0) {
    return null;
  }

  // JPW octave markers:
  //   ' (apostrophe) or g (高/gāo) after digit → +1 octave (+12 semitones)
  //   , (comma)      or d (低/dī)  after digit → -1 octave (-12 semitones)
  const parts = tokenCore.match(/^([gd]?)[0-7]([,']*)([gd]?)$/i);
  const prefix = parts?.[1]?.toLowerCase() ?? "";
  const suffix = parts?.[3]?.toLowerCase() ?? "";
  const octaveText = parts?.[2] ?? "";

  const letterShift =
    (prefix === "g" || suffix === "g" ? 1 : 0) -
    (prefix === "d" || suffix === "d" ? 1 : 0);

  const octaveUp = (octaveText.match(/'/g) ?? []).length;
  const octaveDown = (octaveText.match(/,/g) ?? []).length;
  const octaveShift = (octaveUp - octaveDown + letterShift) * 12;
  const scaleOffset = MAJOR_SCALE_OFFSETS[degree - 1];

  return tonicToMidiRoot(tonic) + scaleOffset + octaveShift;
}

export function midiToPitch(midi: number): { step: string; alter: number; octave: number } {
  const noteNames = [
    { step: "C", alter: 0 },
    { step: "C", alter: 1 },
    { step: "D", alter: 0 },
    { step: "D", alter: 1 },
    { step: "E", alter: 0 },
    { step: "F", alter: 0 },
    { step: "F", alter: 1 },
    { step: "G", alter: 0 },
    { step: "G", alter: 1 },
    { step: "A", alter: 0 },
    { step: "A", alter: 1 },
    { step: "B", alter: 0 },
  ];

  const pitch = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { ...pitch, octave };
}

export function clampDurationBeats(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0.25;
  }
  return Math.max(0.25, Math.round(value * 1000) / 1000);
}
