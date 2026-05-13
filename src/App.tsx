import { useEffect, useMemo, useState } from "react";
import { JianpuScore } from "./components/JianpuScore";
import { VoiceControlCard } from "./components/VoiceControlCard";
import { instrumentOptions } from "./data/instruments";
import { disposePlayback, getPlaybackPositionBeats, isPlaybackRunning, pausePlayback, playProjectSelection, seekPlayback, stopPlayback } from "./lib/audio/playbackEngine";
import { buildMidiFile } from "./lib/export/midi";
import { buildMusicXml } from "./lib/export/musicXml";
import { renderMp3Blob } from "./lib/export/mp3";
import { downloadBlob, readTextFile } from "./lib/files";
import { parseJpwProject } from "./lib/jpw/parser";
import { InstrumentId, VoiceId, type ScoreProject, type VoicePlaybackSettings } from "./types";

function createDefaultVoiceSettings(): VoicePlaybackSettings {
  return {
    [VoiceId.Soprano]: { instrumentId: InstrumentId.BrightPiano, volumeDb: 0 },
    [VoiceId.Alto]: { instrumentId: InstrumentId.WarmPad, volumeDb: -2 },
    [VoiceId.Tenor]: { instrumentId: InstrumentId.ReedOrgan, volumeDb: -1 },
    [VoiceId.Bass]: { instrumentId: InstrumentId.VelvetLead, volumeDb: -4 },
  };
}

export default function App() {
  const [project, setProject] = useState<ScoreProject | null>(null);
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<VoiceId[]>([]);
  const [settings, setSettings] = useState<VoicePlaybackSettings>(createDefaultVoiceSettings);
  const [cursorBeat, setCursorBeat] = useState(0);
  const [playbackBpm, setPlaybackBpm] = useState(88);
  const [transportState, setTransportState] = useState<"stopped" | "playing" | "paused">("stopped");
  const [statusText, setStatusText] = useState("载入 .jpwabc 文件后即可试听与导出。");
  const [busyExport, setBusyExport] = useState<"mp3" | "midi" | "xml" | null>(null);
  const [mp3Progress, setMp3Progress] = useState<number>(0);

  const selectedVoices = useMemo(() => {
    if (!project) {
      return [];
    }
    return project.voices.filter((voice) => selectedVoiceIds.includes(voice.id));
  }, [project, selectedVoiceIds]);

  useEffect(() => {
    return () => {
      disposePlayback();
    };
  }, []);

  useEffect(() => {
    if (!project || transportState !== "playing") {
      return;
    }

    let frame = 0;
    const tick = () => {
      if (!project) {
        return;
      }

      const currentBeat = getPlaybackPositionBeats(project, playbackBpm);
      if (currentBeat >= project.durationBeats) {
        stopPlayback();
        setCursorBeat(0);
        setTransportState("stopped");
        return;
      }

      setCursorBeat(currentBeat);
      if (isPlaybackRunning()) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setTransportState("paused");
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playbackBpm, project, transportState]);

  async function handleFileInput(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const rawText = await readTextFile(file);
      const nextProject = parseJpwProject(rawText, file.name);
      setProject(nextProject);
      setSelectedVoiceIds(nextProject.voices.map((voice) => voice.id));
      setSettings(createDefaultVoiceSettings());
      setPlaybackBpm(nextProject.meta.bpm);
      setCursorBeat(0);
      setTransportState("stopped");
      setStatusText(`已导入 ${file.name}，识别出 ${nextProject.voices.length} 个声部。`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "导入失败。请确认文件格式。");
    }
  }

  async function handlePlay(): Promise<void> {
    if (!project || !selectedVoiceIds.length) {
      setStatusText("请先导入谱面并至少勾选一个声部。");
      return;
    }

    await playProjectSelection(project, selectedVoiceIds, settings, cursorBeat, playbackBpm);
    setTransportState("playing");
    setStatusText(`正在以 ${playbackBpm} BPM 播放 ${selectedVoiceIds.length} 个声部。`);
  }

  async function handleTogglePlayback(): Promise<void> {
    if (transportState === "playing") {
      handlePause();
      return;
    }

    await handlePlay();
  }

  function handlePause(): void {
    if (!project) {
      return;
    }

    pausePlayback();
    setCursorBeat(getPlaybackPositionBeats(project, playbackBpm));
    setTransportState("paused");
    setStatusText("播放已暂停。");
  }

  function handleStop(): void {
    stopPlayback();
    setCursorBeat(0);
    setTransportState("stopped");
    setStatusText("已停止并回到开头。");
  }

  function handleScrub(targetBeat: number): void {
    if (!project) {
      return;
    }

    setCursorBeat(targetBeat);
    seekPlayback(project, targetBeat, playbackBpm, false);
    setTransportState("paused");
    setStatusText(`已定位到 ${targetBeat.toFixed(2)} 拍，等待继续播放。`);
  }

  function updateVoiceSelection(voiceId: VoiceId, checked: boolean): void {
    setSelectedVoiceIds((current) => {
      const next = checked ? [...current, voiceId] : current.filter((value) => value !== voiceId);
      return [...new Set(next)].sort((left, right) => left - right);
    });
  }

  function updatePlaybackBpm(next: number): void {
    setPlaybackBpm(next);
    if (transportState === "playing") {
      pausePlayback();
      setTransportState("paused");
      setStatusText(`已将速度改为 ${next} BPM，播放已暂停。`);
    }
  }

  async function handleExport(kind: "midi" | "xml" | "mp3"): Promise<void> {
    if (!project || !selectedVoiceIds.length) {
      setStatusText("导出前请先导入谱面并至少勾选一个声部。");
      return;
    }

    if (kind === "mp3") {
      setBusyExport("mp3");
      setMp3Progress(0);

      // Fake progress: animate 0 → 88 over estimated render time, snap to 100 when done
      const durationSec = (project.durationBeats / playbackBpm) * 60 + 1;
      const estimatedSec = Math.max(4, durationSec * 0.4);
      const intervalMs = 200;
      const stepSize = 88 / (estimatedSec * 1000 / intervalMs);
      const timer = window.setInterval(() => {
        setMp3Progress((prev) => Math.min(88, prev + stepSize));
      }, intervalMs);

      try {
        const blob = await renderMp3Blob(project, selectedVoiceIds, settings, playbackBpm);
        window.clearInterval(timer);
        setMp3Progress(100);
        await new Promise<void>((resolve) => setTimeout(resolve, 380));
        downloadBlob(blob, `${project.meta.title}.mp3`);
        setStatusText("MP3 导出完成。");
      } catch (error) {
        window.clearInterval(timer);
        setStatusText(error instanceof Error ? error.message : "MP3 导出失败。");
      } finally {
        window.clearInterval(timer);
        setMp3Progress(0);
        setBusyExport(null);
      }
      return;
    }

    try {
      setBusyExport(kind);
      if (kind === "midi") {
        const bytes = buildMidiFile(project, selectedVoiceIds, settings, playbackBpm);
        const midiBytes = Uint8Array.from(bytes);
        downloadBlob(new Blob([midiBytes], { type: "audio/midi" }), `${project.meta.title}.mid`);
      }

      if (kind === "xml") {
        const xml = buildMusicXml(project, selectedVoiceIds);
        downloadBlob(new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" }), `${project.meta.title}.musicxml`);
      }

      setStatusText(`${kind.toUpperCase()} 导出完成。`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "导出失败。请稍后重试。");
    } finally {
      setBusyExport(null);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__title-block">
          <p className="eyebrow">JPW Remix</p>
          <h1>多声部简谱播放与导出工作台</h1>
        </div>

        <label className="upload-card">
          <span>导入 JP-Word 工程</span>
          <strong>{project ? project.fileName : "选择 .jpwabc 文件"}</strong>
          <input accept=".jpwabc" onChange={(event) => void handleFileInput(event.target.files?.[0] ?? null)} type="file" />
        </label>
      </header>

      <main className="workspace-grid">
        <section className="panel panel--controls">
          <div className="section-heading">
            <div>
              <p className="eyebrow">控制台</p>
              <h2>播放与导出</h2>
              <p className="status-pill">{statusText}</p>
            </div>
          </div>

          <div className="transport-row">
            <button
              className={`primary-button transport-toggle transport-toggle--${transportState === "playing" ? "playing" : "paused"}`}
              onClick={() => void handleTogglePlayback()}
              type="button"
            >
              {transportState === "playing" ? "正在播放，点此暂停" : transportState === "paused" ? "已暂停，点此继续" : "开始播放"}
              <span className="transport-toggle__state">{transportState === "playing" ? "PLAYING" : transportState === "paused" ? "PAUSED" : "READY"}</span>
            </button>
            <button className="secondary-button" onClick={handleStop} type="button">
              停止
            </button>
          </div>

          <div className="tempo-panel">
            <label className="field-group">
              <span>BPM {playbackBpm}</span>
              <input
                max={180}
                min={40}
                onChange={(event) => updatePlaybackBpm(Number(event.target.value))}
                type="range"
                value={playbackBpm}
              />
            </label>
            <label className="field-group field-group--compact">
              <span>手动输入</span>
              <input
                max={240}
                min={20}
                onChange={(event) => updatePlaybackBpm(Number(event.target.value))}
                type="number"
                value={playbackBpm}
              />
            </label>
          </div>

          <div className="export-row">
            <button disabled={busyExport !== null} onClick={() => void handleExport("midi")} type="button">
              导出 MIDI
            </button>
            <button disabled={busyExport !== null} onClick={() => void handleExport("xml")} type="button">
              导出 MusicXML
            </button>
            <button
              className="export-btn-mp3"
              disabled={busyExport !== null}
              onClick={() => void handleExport("mp3")}
              type="button"
            >
              {busyExport === "mp3" ? (
                <>
                  <span className="mp3-progress__fill" style={{ width: `${mp3Progress}%` }} />
                  <span className="mp3-progress__label">渲染 MP3… {Math.round(mp3Progress)}%</span>
                </>
              ) : "导出 MP3"}
            </button>
          </div>

          {project ? (
            <div className="meta-grid">
              <article>
                <span>调号</span>
                <strong>1={project.meta.tonic}</strong>
              </article>
              <article>
                <span>拍号</span>
                <strong>{project.meta.timeSignature}</strong>
              </article>
              <article>
                <span>速度</span>
                <strong>{playbackBpm} BPM</strong>
              </article>
              <article>
                <span>定位</span>
                <strong>{cursorBeat.toFixed(2)} 拍</strong>
              </article>
            </div>
          ) : null}

          <div className="voice-grid">
            {project?.voices.map((voice) => (
              <VoiceControlCard
                key={voice.id}
                onInstrumentChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    [voice.id]: { ...current[voice.id], instrumentId: value as InstrumentId },
                  }))
                }
                onToggle={(checked) => updateVoiceSelection(voice.id, checked)}
                onVolumeChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    [voice.id]: { ...current[voice.id], volumeDb: value },
                  }))
                }
                selected={selectedVoiceIds.includes(voice.id)}
                setting={settings[voice.id]}
                voice={voice}
              />
            ))}
          </div>

          <div className="instrument-legend">
            <span>可选音色</span>
            <div>
              {instrumentOptions.map((instrument) => (
                <small key={instrument.id}>{instrument.label}</small>
              ))}
            </div>
          </div>
        </section>

        <section className="panel panel--score">
          <div className="section-heading">
            <div>
              <p className="eyebrow">可点击谱面</p>
              <h2>完整简谱视图</h2>
            </div>
            <p>{selectedVoices.length ? `当前导出/播放 ${selectedVoices.length} 个声部` : "未选择声部"}</p>
          </div>

          {project ? (
            <div className="score-stack">
              <JianpuScore currentBeat={cursorBeat} onScrub={handleScrub} project={project} />
            </div>
          ) : (
            <div className="empty-state">
              <h3>等待导入谱面</h3>
              <p>导入当前目录里的 .jpwabc 后，这里会显示完整简谱，可点击音符或拖动到任意位置定位并继续播放。</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
