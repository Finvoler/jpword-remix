import type { ScoreProject, VoicePart } from "../types";

interface ScoreLaneProps {
  project: ScoreProject;
  voice: VoicePart;
  currentBeat: number;
  onSeek: (beat: number) => void;
}

export function ScoreLane({ project, voice, currentBeat, onSeek }: ScoreLaneProps) {
  const pixelsPerBeat = 72;
  const laneWidth = Math.max(960, project.durationBeats * pixelsPerBeat);
  const totalMeasures = Math.max(1, Math.ceil(project.durationBeats / project.meta.beatsPerMeasure));

  return (
    <section className="score-lane">
      <header className="score-lane__header">
        <div>
          <strong>{voice.name}</strong>
          <span>{voice.shortName}</span>
        </div>
        <button className="ghost-button" onClick={() => onSeek(0)} type="button">
          回到开头
        </button>
      </header>

      <div className="score-lane__viewport">
        <div className="score-lane__track" style={{ width: `${laneWidth}px` }}>
          {Array.from({ length: totalMeasures }, (_, index) => {
            const left = index * project.meta.beatsPerMeasure * pixelsPerBeat;
            return (
              <div className="measure-marker" key={`${voice.id}-measure-${index}`} style={{ left: `${left}px` }}>
                <span>#{index + 1}</span>
              </div>
            );
          })}

          <div className="playhead" style={{ left: `${Math.max(0, currentBeat * pixelsPerBeat)}px` }} />

          {voice.events.map((event) => (
            <button
              className="note-chip"
              key={event.id}
              onClick={() => onSeek(event.startBeats)}
              style={{
                left: `${event.startBeats * pixelsPerBeat}px`,
                width: `${Math.max(22, event.durationBeats * pixelsPerBeat - 6)}px`,
              }}
              title={`${event.label} | ${event.startBeats.toFixed(2)} 拍`}
              type="button"
            >
              {event.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
