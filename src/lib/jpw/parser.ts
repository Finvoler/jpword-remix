import { VoiceId, type NoteEvent, type NotationMark, type ProjectMeta, type ScoreMeasure, type ScoreProject, type ScoreRow, type ScoreSystem, type ScoreToken, type VoicePart } from "../../types";
import { clampDurationBeats, tokenToMidi } from "../music/numeric";

// Matches any JPW note token with timing annotation.
// Group 1: opening slur parens  Group 2: token core (with optional # sharp prefix)
// Group 3: duration shape (_, -, .)  Group 4: timing float value
// Group 5: closing slur parens
// The {C:N...} pattern handles all modifier variants: plain N, N,None, N,Other,
// N(beat,breakdown,...), N(beats...),None, N,,  etc.
const TOKEN_REGEX = /(\(*)?([#]?[A-Za-z]?[0-7][,']*[A-Za-z]?)([_\.-]*)\{C:([0-9.]+)(?:\([^}]*\))?[^}]*\}(\)*)/g;
const DEFAULT_BPM = 88;

const genericVoiceLabels = ["声部一", "声部二", "声部三", "声部四"];

function parseTokenCore(tokenCore: string): { accidental: "sharp" | "flat" | null; octaveShift: number } {
  // Strip # (sharp) or b-before-digit (flat) prefix, then parse octave markers.
  // JPW octave markers: ' or g (高) → +1 octave; , or d (低) → -1 octave
  let accidental: "sharp" | "flat" | null = null;
  let core = tokenCore;
  if (core.startsWith("#")) {
    accidental = "sharp";
    core = core.slice(1);
  } else if (/^b[1-7]/.test(core)) {
    // 'b' immediately before a digit means flat accidental (not a g/d octave letter)
    accidental = "flat";
    core = core.slice(1);
  }

  const parts = core.match(/^([gd]?)[0-7]([,']*)([gd]?)$/i);
  const prefix = parts?.[1]?.toLowerCase() ?? "";
  const suffix = parts?.[3]?.toLowerCase() ?? "";
  const octaveText = parts?.[2] ?? "";

  const letterShift =
    (prefix === "g" || suffix === "g" ? 1 : 0) -
    (prefix === "d" || suffix === "d" ? 1 : 0);

  return {
    accidental,
    octaveShift:
      (octaveText.match(/'/g) ?? []).length -
      (octaveText.match(/,/g) ?? []).length +
      letterShift,
  };
}

function median(values: number[]): number {
  if (!values.length) {
    return 3.2;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getVoiceSection(rawText: string): string {
  const start = rawText.indexOf(".Voice");
  if (start < 0) {
    throw new Error("未找到 .Voice 段，无法解析声部。");
  }

  const nextAnchors = ["\r\n.Words", "\n.Words", "\r\n.Attachments", "\n.Attachments", "\r\n.Page", "\n.Page"];
  const end = nextAnchors
    .map((anchor) => rawText.indexOf(anchor, start))
    .filter((index) => index > start)
    .sort((left, right) => left - right)[0] ?? rawText.length;

  return rawText.slice(start, end);
}

function parseMeta(rawText: string, fileName: string, voiceSection: string): ProjectMeta {
  const keyMatch = rawText.match(/KeyAndMeters\s*=\s*\{1=([A-G][b#]?|[A-G]),\s*([0-9]+)\/([0-9]+)\}/);
  const tonic = keyMatch?.[1] ?? "C";
  const beatsPerMeasure = Number(keyMatch?.[2] ?? 4);
  const beatUnit = Number(keyMatch?.[3] ?? 4);

  const tempoMatch = rawText.match(/(?:Tempo|PlaySpeed|QPM)\s*=\s*([0-9.]+)/i);
  const bpm = tempoMatch ? Number(tempoMatch[1]) : DEFAULT_BPM;

  const quarterCandidates = Array.from(voiceSection.matchAll(/\{C:([0-9.]+)/g))
    .map((match) => Number(match[1]))
    .filter((value) => value >= 2.7 && value <= 3.4);

  const quarterUnit = median(quarterCandidates);
  const title = fileName.replace(/\.jpwabc$/i, "");

  return {
    title,
    tonic,
    timeSignature: `${beatsPerMeasure}/${beatUnit}`,
    bpm,
    beatsPerMeasure,
    beatUnit,
    quarterUnit,
  };
}

function splitVoiceSegments(line: string): string[] {
  // Match any barline variant followed by {C:...}: |{C:, |:{C:, :|{C:, ||{C:, |]{C:, etc.
  const matches = Array.from(line.matchAll(/\|[|:\]]*\{C:[^}]+\}/g));
  if (!matches.length) {
    return [];
  }

  const segments: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? line.length;
    const segment = line.slice(start, end).replace(/\$\([^)]*\)/g, " ").trim();
    segments.push(segment);
  }

  return segments;
}

function splitVoiceBlocks(voiceSection: string): string[] {
  const lines = voiceSection.split(/\r?\n/).slice(1);
  const blocks: string[] = [];
  let current: string[] = [];
  let hasNotation = false;

  const flush = () => {
    if (hasNotation && current.length > 0) {
      blocks.push(current.join("\n"));
    }
    current = [];
    hasNotation = false;
  };

  for (const line of lines) {
    if (line.trim() === "$") {
      flush();
      continue;
    }

    current.push(line);
    if (line.includes("|{C:")) {
      hasNotation = true;
    }
  }

  flush();
  return blocks;
}

function hasPlayableToken(segment: string): boolean {
  return /[#]?[A-Za-z]?[0-7][,']*[A-Za-z]?[_\.-]*\{C:/.test(segment);
}

function splitMeasureSegments(rowLine: string): string[] {
  const segments = splitVoiceSegments(rowLine)
    .map((segment) => segment.replace(/\$\([^)]*\)/g, " ").trim())
    .filter((segment) => segment.length > 0);

  if (segments.length > 1 && !hasPlayableToken(segments[segments.length - 1])) {
    segments.pop();
  }

  return segments;
}

function buildNotationMark(tokenCore: string, shape: string, slurStart: number, slurEnd: number): NotationMark {
  const parsedTokenCore = parseTokenCore(tokenCore);
  return {
    degree: tokenCore.match(/[0-7]/)?.[0] ?? "0",
    accidental: parsedTokenCore.accidental,
    octaveShift: parsedTokenCore.octaveShift,
    underscoreCount: (shape.match(/_/g) ?? []).length,
    dashCount: (shape.match(/-/g) ?? []).length,
    dotted: shape.includes("."),
    slurStart,
    slurEnd,
  };
}

function getDurationBeatsFromShape(shape: string, beatUnit: number): number {
  const quarterBeats = 4 / beatUnit;
  const underscoreCount = (shape.match(/_/g) ?? []).length;
  const dashCount = (shape.match(/-/g) ?? []).length;
  const dotCount = (shape.match(/\./g) ?? []).length;

  let duration = quarterBeats / 2 ** underscoreCount;
  if (underscoreCount === 0 && dashCount > 0) {
    duration += dashCount * quarterBeats;
  }

  if (dotCount > 0) {
    let multiplier = 1;
    for (let index = 1; index <= dotCount; index += 1) {
      multiplier += 1 / 2 ** index;
    }
    duration *= multiplier;
  }

  return clampDurationBeats(duration);
}

function parseMeasureTokens(
  voiceId: VoiceId,
  systemIndex: number,
  measureIndex: number,
  measureText: string,
  meta: ProjectMeta,
): { tokens: ScoreToken[]; events: NoteEvent[] } {
  const tokens: ScoreToken[] = [];
  const events: NoteEvent[] = [];
  let tokenIndex = 0;
  let beatInMeasure = 0;

  TOKEN_REGEX.lastIndex = 0;
  for (const match of measureText.matchAll(TOKEN_REGEX)) {
    const slurStart = match[1]?.length ?? 0;
    const tokenCore = match[2];
    const shape = match[3] ?? "";
    const slurEnd = match[5]?.length ?? 0;
    const durationBeats = getDurationBeatsFromShape(shape, meta.beatUnit);
    const rawToken = `${tokenCore}${shape}`;
    const startBeats = measureIndex * meta.beatsPerMeasure + beatInMeasure;
    const midi = tokenToMidi(meta.tonic, tokenCore);
    const token: ScoreToken = {
      id: `V${voiceId}-M${measureIndex}-T${tokenIndex}`,
      voiceId,
      systemIndex,
      measureIndex,
      beatInMeasure,
      startBeats,
      durationBeats,
      rawToken,
      midi,
      isRest: midi === null,
      notation: buildNotationMark(tokenCore, shape, slurStart, slurEnd),
    };

    tokens.push(token);
    if (midi !== null) {
      events.push({
        id: token.id,
        voiceId,
        systemIndex,
        segmentIndex: measureIndex % 4,
        measureIndex,
        beatInMeasure,
        label: rawToken,
        rawToken,
        midi,
        startBeats,
        durationBeats,
      });
    }

    beatInMeasure += durationBeats;
    tokenIndex += 1;
  }

  return { tokens, events };
}

export function parseJpwProject(rawText: string, fileName: string): ScoreProject {
  const voiceSection = getVoiceSection(rawText);
  const meta = parseMeta(rawText, fileName, voiceSection);
  const blocks = splitVoiceBlocks(voiceSection);
  const blockRows = blocks.map((block) => block.split(/\r?\n/).filter((line) => line.includes("|{C:")));

  // Detect single-voice: when there is only one non-empty block, all its rows represent
  // separate systems for a single voice (no $ separators in the file).
  // Multi-voice files always use $ to separate voices, producing multiple non-empty blocks.
  const nonEmptyBlockRows = blockRows.filter((rows) => rows.length > 0);
  let effectiveBlockRows: string[][];
  let voiceCount: number;

  if (nonEmptyBlockRows.length === 1) {
    // Single-voice file: one block contains all system rows sequentially
    voiceCount = 1;
    effectiveBlockRows = nonEmptyBlockRows[0].map((row) => [row]);
  } else {
    // Multi-voice file: each block is a system, rows within the block = voices
    voiceCount = blockRows.reduce((max, rows) => Math.max(max, rows.length), 0);
    effectiveBlockRows = blockRows;
  }

  if (voiceCount === 0) {
    throw new Error("未识别到可播放的声部谱行。");
  }

  const voiceIds = [VoiceId.Soprano, VoiceId.Alto, VoiceId.Tenor, VoiceId.Bass].slice(0, voiceCount);
  const voiceMap = new Map<VoiceId, VoicePart>(
    voiceIds.map((voiceId, index) => {
      return [
        voiceId,
        {
          id: voiceId,
          name: genericVoiceLabels[index] ?? `声部${index + 1}`,
          shortName: `${index + 1}`,
          events: [],
          tokens: [],
        },
      ];
    }),
  );

  const systems: ScoreSystem[] = [];
  let globalMeasureIndex = 0;

  effectiveBlockRows.forEach((rows, systemIndex) => {
    const rowSegments = rows.map((row) => splitMeasureSegments(row));
    const measureCount = rowSegments.reduce((max, segments) => Math.max(max, segments.length), 0);
    const systemRows: ScoreRow[] = [];

    voiceIds.forEach((voiceId, rowIndex) => {
      const measureTexts = rowSegments[rowIndex] ?? [];
      const measures: ScoreMeasure[] = [];
      const voice = voiceMap.get(voiceId)!;

      for (let measureOffset = 0; measureOffset < measureCount; measureOffset += 1) {
        const measureIndex = globalMeasureIndex + measureOffset;
        const measureText = measureTexts[measureOffset] ?? "";
        const { tokens, events } = parseMeasureTokens(voiceId, systemIndex, measureIndex, measureText, meta);
        measures.push({
          index: measureIndex,
          startBeats: measureIndex * meta.beatsPerMeasure,
          tokens,
        });
        voice.tokens.push(...tokens);
        voice.events.push(...events);
      }

      systemRows.push({
        voiceId,
        measures,
      });
    });

    systems.push({
      index: systemIndex,
      measureCount,
      rows: systemRows,
    });
    globalMeasureIndex += measureCount;
  });

  const voices = voiceIds.map((voiceId) => voiceMap.get(voiceId)!).filter((voice) => voice.events.length > 0 || voice.tokens.length > 0);
  const durationBeats = globalMeasureIndex * meta.beatsPerMeasure;

  return {
    fileName,
    rawText,
    meta,
    voices,
    voiceCount,
    systems,
    durationBeats,
  };
}
