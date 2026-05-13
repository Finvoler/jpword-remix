import type { NoteEvent, ScoreProject, VoiceId } from "../../types";
import { midiToPitch } from "../music/numeric";

interface TimelineItem {
  measureIndex: number;
  xml: string;
}

const DIVISIONS = 480;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function durationToType(durationDivisions: number): string {
  if (durationDivisions >= DIVISIONS * 4) return "whole";
  if (durationDivisions >= DIVISIONS * 2) return "half";
  if (durationDivisions >= DIVISIONS) return "quarter";
  if (durationDivisions >= DIVISIONS / 2) return "eighth";
  if (durationDivisions >= DIVISIONS / 4) return "16th";
  return "32nd";
}

function buildNoteXml(event: NoteEvent, durationBeats: number, tieStart: boolean, tieStop: boolean): string {
  const pitch = midiToPitch(event.midi);
  const duration = Math.max(1, Math.round(durationBeats * DIVISIONS));
  const type = durationToType(duration);
  const tieMarkup = [
    tieStart ? '<tie type="start"/>' : '',
    tieStop ? '<tie type="stop"/>' : '',
  ].join('');
  const notationMarkup = tieStart || tieStop
    ? `<notations>${tieStart ? '<tied type="start"/>' : ''}${tieStop ? '<tied type="stop"/>' : ''}</notations>`
    : '';

  return `
      <note>
        <pitch>
          <step>${pitch.step}</step>
          ${pitch.alter !== 0 ? `<alter>${pitch.alter}</alter>` : ''}
          <octave>${pitch.octave}</octave>
        </pitch>
        <duration>${duration}</duration>
        <type>${type}</type>
        ${tieMarkup}
        ${notationMarkup}
      </note>`;
}

function buildRestXml(durationBeats: number): string {
  const duration = Math.max(1, Math.round(durationBeats * DIVISIONS));
  const type = durationToType(duration);
  return `
      <note>
        <rest/>
        <duration>${duration}</duration>
        <type>${type}</type>
      </note>`;
}

function pushTimelineItems(
  items: TimelineItem[],
  startBeats: number,
  durationBeats: number,
  beatsPerMeasure: number,
  xmlBuilder: (chunkDuration: number, isFirst: boolean, isLast: boolean) => string,
): void {
  let cursor = startBeats;
  let remaining = durationBeats;
  let partIndex = 0;

  while (remaining > 0.0001) {
    const measureIndex = Math.floor(cursor / beatsPerMeasure);
    const measureEnd = (measureIndex + 1) * beatsPerMeasure;
    const chunkDuration = Math.min(remaining, measureEnd - cursor);
    items.push({
      measureIndex,
      xml: xmlBuilder(chunkDuration, partIndex === 0, remaining - chunkDuration <= 0.0001),
    });
    cursor += chunkDuration;
    remaining -= chunkDuration;
    partIndex += 1;
  }
}

function buildPartMeasures(project: ScoreProject, events: NoteEvent[]): string {
  const timelineItems: TimelineItem[] = [];
  let cursor = 0;

  events.forEach((event) => {
    if (event.startBeats > cursor + 0.0001) {
      pushTimelineItems(
        timelineItems,
        cursor,
        event.startBeats - cursor,
        project.meta.beatsPerMeasure,
        (chunkDuration) => buildRestXml(chunkDuration),
      );
    }

    pushTimelineItems(
      timelineItems,
      event.startBeats,
      event.durationBeats,
      project.meta.beatsPerMeasure,
      (chunkDuration, isFirst, isLast) => buildNoteXml(event, chunkDuration, !isLast, !isFirst),
    );

    cursor = event.startBeats + event.durationBeats;
  });

  const totalMeasures = Math.max(1, Math.ceil(project.durationBeats / project.meta.beatsPerMeasure));
  const measures = Array.from({ length: totalMeasures }, (_, index) => index).map((measureIndex) => {
    const body = timelineItems
      .filter((item) => item.measureIndex === measureIndex)
      .map((item) => item.xml)
      .join("");

    const attributes = measureIndex === 0
      ? `
      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time>
          <beats>${project.meta.beatsPerMeasure}</beats>
          <beat-type>${project.meta.beatUnit}</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>`
      : "";

    return `
    <measure number="${measureIndex + 1}">${attributes}${body || buildRestXml(project.meta.beatsPerMeasure)}
    </measure>`;
  });

  return measures.join("");
}

export function buildMusicXml(project: ScoreProject, selectedVoiceIds: VoiceId[]): string {
  const selectedVoices = project.voices.filter((voice) => selectedVoiceIds.includes(voice.id));

  const partList = selectedVoices
    .map((voice, index) => `
    <score-part id="P${index + 1}">
      <part-name>${escapeXml(voice.name)}</part-name>
    </score-part>`)
    .join("");

  const parts = selectedVoices
    .map((voice, index) => `
  <part id="P${index + 1}">${buildPartMeasures(project, voice.events)}
  </part>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(project.meta.title)}</work-title>
  </work>
  <part-list>${partList}
  </part-list>${parts}
</score-partwise>`;
}
