# 功能池与接口枚举号

| 枚举号 | 功能名 | 接口名 | 状态 |
| --- | --- | --- | --- |
| 1001 | JPWABC 导入 | `parseJpwProject` | 已实现 |
| 1002 | 四声部解析 | `parseVoiceSegments` | 已实现 |
| 1101 | 多声部组合播放 | `playProjectSelection` | 已实现 |
| 1102 | 声部乐器与音量控制 | `VoicePlaybackSettings` | 已实现 |
| 1103 | 任意声部子集导出 | `buildMidiFile` / `buildMusicXml` / `renderMp3Blob` | 已实现 |
| 1104 | 点击谱面跳播 | `seekPlayback` | 已实现 |
| 1201 | MIDI 导出 | `buildMidiFile` | 已实现 |
| 1202 | MusicXML 导出 | `buildMusicXml` | 已实现 |
| 1203 | MP3 导出 | `renderMp3Blob` | 已实现 |
| 1301 | 功能池说明 | `featurePool` | 已实现 |

## 现阶段实现边界

- 直接基于 `.jpwabc` 文本重建播放与导出链路，不复用原 exe 内部代码。
- 声部选择覆盖播放与导出两个入口，允许任意 1 到 4 个声部组合。
- MP3 采用浏览器内离线渲染，不依赖 ffmpeg。
- MusicXML 以分 part 的线性时间轴导出为主，适合作为继续编辑的交换格式。
