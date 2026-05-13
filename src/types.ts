export enum VoiceId {
  Soprano = 1,
  Alto = 2,
  Tenor = 3,
  Bass = 4,
}

export enum InstrumentId {
  BrightPiano = 2001,
  WarmPad = 2002,
  ReedOrgan = 2003,
  CrystalBell = 2004,
  VelvetLead = 2005,
}

export enum FeatureId {
  ImportJpw = 1001,
  ParseMultiVoice = 1002,
  MultiVoicePlayback = 1101,
  VoiceMixing = 1102,
  VoiceSubsetPlayback = 1103,
  ClickToSeek = 1104,
  ExportMidi = 1201,
  ExportMusicXml = 1202,
  ExportMp3 = 1203,
  FeaturePool = 1301,
}

export enum FeatureStatus {
  Planned = "planned",
  Implemented = "implemented",
}

export interface ProjectMeta {
  title: string;
  tonic: string;
  timeSignature: string;
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  quarterUnit: number;
}

export interface NoteEvent {
  id: string;
  voiceId: VoiceId;
  systemIndex: number;
  segmentIndex: number;
  measureIndex: number;
  beatInMeasure: number;
  label: string;
  rawToken: string;
  midi: number;
  startBeats: number;
  durationBeats: number;
}

export interface NotationMark {
  degree: string;
  accidental: "sharp" | "flat" | null;
  octaveShift: number;
  underscoreCount: number;
  dashCount: number;
  dotted: boolean;
  slurStart: number;
  slurEnd: number;
}

export interface ScoreToken {
  id: string;
  voiceId: VoiceId;
  systemIndex: number;
  measureIndex: number;
  beatInMeasure: number;
  startBeats: number;
  durationBeats: number;
  rawToken: string;
  midi: number | null;
  isRest: boolean;
  notation: NotationMark;
}

export interface ScoreMeasure {
  index: number;
  startBeats: number;
  tokens: ScoreToken[];
}

export interface ScoreRow {
  voiceId: VoiceId;
  measures: ScoreMeasure[];
}

export interface ScoreSystem {
  index: number;
  measureCount: number;
  rows: ScoreRow[];
}

export interface VoicePart {
  id: VoiceId;
  name: string;
  shortName: string;
  events: NoteEvent[];
  tokens: ScoreToken[];
}

export interface ScoreProject {
  fileName: string;
  rawText: string;
  meta: ProjectMeta;
  voices: VoicePart[];
  voiceCount: number;
  systems: ScoreSystem[];
  durationBeats: number;
}

export interface VoicePlaybackSetting {
  instrumentId: InstrumentId;
  volumeDb: number;
}

export type VoicePlaybackSettings = Record<VoiceId, VoicePlaybackSetting>;

export interface FeatureDescriptor {
  id: FeatureId;
  title: string;
  description: string;
  status: FeatureStatus;
  interfaceName: string;
}

export interface InstrumentPreset {
  id: InstrumentId;
  label: string;
  midiProgram: number;
  synthKind: "Synth" | "AMSynth" | "FMSynth" | "DuoSynth";
  options: Record<string, unknown>;
}
