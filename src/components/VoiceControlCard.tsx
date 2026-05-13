import { instrumentOptions } from "../data/instruments";
import type { VoicePart, VoicePlaybackSetting } from "../types";

interface VoiceControlCardProps {
  voice: VoicePart;
  selected: boolean;
  setting: VoicePlaybackSetting;
  onToggle: (checked: boolean) => void;
  onInstrumentChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
}

export function VoiceControlCard({
  voice,
  selected,
  setting,
  onToggle,
  onInstrumentChange,
  onVolumeChange,
}: VoiceControlCardProps) {
  return (
    <article className={`voice-card ${selected ? "voice-card--selected" : ""}`}>
      <label className="voice-card__header">
        <input checked={selected} onChange={(event) => onToggle(event.target.checked)} type="checkbox" />
        <div>
          <strong>{voice.name}</strong>
          <span>{voice.events.length} 个音符事件</span>
        </div>
      </label>

      <label className="field-group">
        <span>乐器</span>
        <select value={setting.instrumentId} onChange={(event) => onInstrumentChange(Number(event.target.value))}>
          {instrumentOptions.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              {instrument.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span>音量 {setting.volumeDb} dB</span>
        <input
          max={6}
          min={-24}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          type="range"
          value={setting.volumeDb}
        />
      </label>
    </article>
  );
}
