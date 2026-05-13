import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceId, type ScoreMeasure, type ScoreProject, type ScoreSystem, type ScoreToken, type VoicePart } from "../types";

const LABEL_WIDTH = 88;
const BASE_MEASURE_WIDTH = 176;
const MAX_MEASURE_WIDTH = 212;
const SLOT_WIDTH = 28;
const MEASURE_INSET = 18;

interface JianpuScoreProps {
  currentBeat: number;
  project: ScoreProject;
  onScrub: (beat: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundBeat(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getSmallestSubdivision(tokens: ScoreToken[]): number {
  if (!tokens.length) {
    return 1;
  }

  return tokens.reduce((smallest, token) => Math.min(smallest, token.durationBeats), 1);
}

function getMeasureWidth(measure: ScoreMeasure, beatsPerMeasure: number): number {
  const subdivision = Math.max(0.125, getSmallestSubdivision(measure.tokens));
  const slotCount = Math.ceil(beatsPerMeasure / subdivision);
  const densityWidth = slotCount * SLOT_WIDTH;
  const contentWidth = measure.tokens.reduce((max, token) => {
    const tokenStart = (token.beatInMeasure / beatsPerMeasure) * densityWidth;
    const tokenWidth = Math.max(36, (token.durationBeats / beatsPerMeasure) * densityWidth);
    return Math.max(max, tokenStart + tokenWidth + 12);
  }, 0);

  return Math.min(MAX_MEASURE_WIDTH, Math.max(BASE_MEASURE_WIDTH, densityWidth, contentWidth));
}

function tokenLeftPx(token: ScoreToken, beatsPerMeasure: number, measureWidth: number): number {
  const innerWidth = measureWidth - MEASURE_INSET * 2;
  return MEASURE_INSET + (token.beatInMeasure / beatsPerMeasure) * innerWidth;
}

function tokenWidthPx(token: ScoreToken, beatsPerMeasure: number, measureWidth: number): number {
  const innerWidth = measureWidth - MEASURE_INSET * 2;
  return Math.max(24, (token.durationBeats / beatsPerMeasure) * innerWidth);
}

function DotStack({ count }: { count: number }) {
  return (
    <span className="jianpu-dot-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span className="jianpu-dot-stack__dot" key={index} />
      ))}
    </span>
  );
}

function measureHasPlayhead(measure: ScoreMeasure, currentBeat: number, beatsPerMeasure: number, isLastMeasure: boolean): boolean {
  const measureEnd = measure.startBeats + beatsPerMeasure;
  if (currentBeat >= measure.startBeats && currentBeat < measureEnd) {
    return true;
  }

  return isLastMeasure && currentBeat === measureEnd;
}

function TokenGlyph({ token, beatsPerMeasure, measureWidth, onScrub }: { token: ScoreToken; beatsPerMeasure: number; measureWidth: number; onScrub: (beat: number) => void }) {
  const accidental = token.notation.accidental === "sharp" ? "♯" : token.notation.accidental === "flat" ? "♭" : "";
  const lowDotCount = token.notation.octaveShift < 0 ? Math.abs(token.notation.octaveShift) : 0;
  const highDotCount = token.notation.octaveShift > 0 ? token.notation.octaveShift : 0;
  const underlineCount = token.notation.underscoreCount;

  return (
    <button
      className={`jianpu-token ${token.isRest ? "jianpu-token--rest" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onScrub(token.startBeats);
      }}
      style={{ left: `${tokenLeftPx(token, beatsPerMeasure, measureWidth)}px`, width: `${tokenWidthPx(token, beatsPerMeasure, measureWidth)}px` }}
      title={`${token.rawToken} | 第 ${token.measureIndex + 1} 小节 | acc:${token.notation.accidental ?? "none"} oct:${token.notation.octaveShift}`}
      type="button"
    >
      {/* Vertical column: hi-oct · digit · underlines · lo-oct — all centered on same axis */}
      <span className="jianpu-token__col">
        <span className="jianpu-token__hi-oct">
          {highDotCount > 0 ? <DotStack count={highDotCount} /> : null}
        </span>
        <span className="jianpu-token__digit-row">
          {accidental ? <span className="jianpu-token__acc">{accidental}</span> : null}
          <span className="jianpu-token__deg">{token.notation.degree}</span>
          {token.notation.dotted ? <span className="jianpu-token__rdot" aria-hidden="true" /> : null}
        </span>
        <span className="jianpu-token__lines" aria-hidden={underlineCount === 0}>
          {Array.from({ length: underlineCount }, (_, index) => (
            <span className="jianpu-token__line" key={`${token.id}-line-${index}`} />
          ))}
        </span>
        <span className="jianpu-token__lo-oct">
          {lowDotCount > 0 ? <DotStack count={lowDotCount} /> : null}
        </span>
      </span>
      {/* Extension dashes – absolutely positioned at the vertical center of the digit row */}
      {token.notation.dashCount > 0 ? (
        <span className="jianpu-token__ext" aria-hidden="true">
          {Array.from({ length: token.notation.dashCount }, (_, index) => (
            <span className="jianpu-token__dash" key={`${token.id}-dash-${index}`} />
          ))}
        </span>
      ) : null}
    </button>
  );
}

function SystemView({
  currentBeat,
  project,
  system,
  uniformMeasureWidth,
  voiceLookup,
  onScrub,
}: {
  currentBeat: number;
  project: ScoreProject;
  system: ScoreSystem;
  uniformMeasureWidth: number;
  voiceLookup: Map<VoiceId, VoicePart>;
  onScrub: (beat: number) => void;
}) {
  const systemStartBeat = system.rows[0]?.measures[0]?.startBeats ?? 0;
  const systemBeats = system.measureCount * project.meta.beatsPerMeasure;
  const systemEndBeat = systemStartBeat + systemBeats;
  const showPlayhead = currentBeat >= systemStartBeat && currentBeat <= systemEndBeat;
  const cumulativeWidths = useMemo(() => Array.from({ length: system.measureCount + 1 }, (_, index) => index * uniformMeasureWidth), [system.measureCount, uniformMeasureWidth]);
  const totalMeasureWidth = cumulativeWidths[cumulativeWidths.length - 1] ?? 0;

  function beatToSystemX(beat: number): number {
    const safeBeat = clamp(beat - systemStartBeat, 0, systemBeats);
    const measureIndex = Math.min(system.measureCount - 1, Math.floor(safeBeat / project.meta.beatsPerMeasure));
    const beatInMeasure = safeBeat - measureIndex * project.meta.beatsPerMeasure;
    return LABEL_WIDTH + cumulativeWidths[measureIndex] + (beatInMeasure / project.meta.beatsPerMeasure) * uniformMeasureWidth;
  }

  const playheadLeft = beatToSystemX(currentBeat);

  function scrubFromEvent(target: HTMLDivElement, clientX: number): void {
    const rect = target.getBoundingClientRect();
    const x = clamp(clientX - rect.left - LABEL_WIDTH, 0, totalMeasureWidth);
    let measureIndex = 0;
    while (measureIndex < system.measureCount - 1 && x > cumulativeWidths[measureIndex + 1]) {
      measureIndex += 1;
    }
    const localX = x - cumulativeWidths[measureIndex];
    const beatOffset = measureIndex * project.meta.beatsPerMeasure + (localX / uniformMeasureWidth) * project.meta.beatsPerMeasure;
    onScrub(roundBeat(systemStartBeat + beatOffset));
  }

  function beginScrub(event: React.PointerEvent<HTMLDivElement>): void {
    const target = event.currentTarget;
    scrubFromEvent(target, event.clientX);

    const move = (moveEvent: PointerEvent) => scrubFromEvent(target, moveEvent.clientX);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  return (
    <section className="jianpu-system">
      <header className="jianpu-system__header">
        <strong>系统 {system.index + 1}</strong>
        <span>{system.measureCount} 小节</span>
      </header>
      <div className="jianpu-system__track" onPointerDown={beginScrub} role="presentation" style={{ width: `${LABEL_WIDTH + totalMeasureWidth}px` }}>
        {showPlayhead ? <div className="jianpu-playhead" style={{ left: `${playheadLeft}px` }} /> : null}
        {system.rows.map((row, rowIndex) => {
          const voice = voiceLookup.get(row.voiceId);
          return (
            <div className="jianpu-row" key={`${system.index}-${row.voiceId}`}>
              <div className="jianpu-row__label">
                <strong>{voice?.name ?? `声部 ${row.voiceId}`}</strong>
                <span>{voice?.shortName ?? `V${row.voiceId}`}</span>
              </div>
              <div className="jianpu-row__measures">
                {row.measures.map((measure, measureIndex) => {
                  const isLastMeasure = system.index === project.systems.length - 1 && measureIndex === row.measures.length - 1;
                  const playheadInMeasure = measureHasPlayhead(measure, currentBeat, project.meta.beatsPerMeasure, isLastMeasure);
                  const playheadMeasureOffset = currentBeat - measure.startBeats;
                  const playheadInnerLeft = clamp((playheadMeasureOffset / project.meta.beatsPerMeasure) * uniformMeasureWidth, 0, uniformMeasureWidth);
                  return (
                    <div className="jianpu-measure" key={`${row.voiceId}-${measure.index}`} style={{ width: `${uniformMeasureWidth}px` }}>
                      {rowIndex === 0 ? <span className="jianpu-measure__number">{measure.index + 1}</span> : null}
                      {playheadInMeasure ? <div className="jianpu-measure__playhead" style={{ left: `${playheadInnerLeft}px` }} /> : null}
                      {measure.tokens.map((token) => (
                        <TokenGlyph beatsPerMeasure={project.meta.beatsPerMeasure} key={token.id} measureWidth={uniformMeasureWidth} onScrub={onScrub} token={token} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function JianpuScore({ currentBeat, project, onScrub }: JianpuScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const voiceLookup = useMemo(() => new Map(project.voices.map((voice) => [voice.id, voice])), [project.voices]);
  const contentMeasureWidth = useMemo(() => {
    const measures = project.systems.flatMap((system) => system.rows.flatMap((row) => row.measures));
    return measures.reduce((max, measure) => Math.max(max, getMeasureWidth(measure, project.meta.beatsPerMeasure)), BASE_MEASURE_WIDTH);
  }, [project.meta.beatsPerMeasure, project.systems]);

  const maxMeasureCount = useMemo(
    () => project.systems.reduce((max, system) => Math.max(max, system.measureCount), 1),
    [project.systems],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setAvailableWidth(element.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stretchedMeasureWidth = availableWidth > LABEL_WIDTH
    ? Math.floor((availableWidth - LABEL_WIDTH - 8) / Math.max(maxMeasureCount, 1))
    : contentMeasureWidth;
  const uniformMeasureWidth = Math.max(contentMeasureWidth, stretchedMeasureWidth);

  return (
    <div className="jianpu-score" ref={containerRef}>
      {project.systems.map((system) => (
        <SystemView currentBeat={currentBeat} key={system.index} onScrub={onScrub} project={project} system={system} uniformMeasureWidth={uniformMeasureWidth} voiceLookup={voiceLookup} />
      ))}
    </div>
  );
}