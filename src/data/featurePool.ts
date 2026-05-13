import { FeatureId, FeatureStatus, type FeatureDescriptor } from "../types";

export const featurePool: FeatureDescriptor[] = [
  {
    id: FeatureId.ImportJpw,
    title: "JPWABC 导入",
    description: "导入 UTF-16 编码的 .jpwabc 工程文本，并抽取全局调号、拍号和四声部内容。",
    status: FeatureStatus.Implemented,
    interfaceName: "parseJpwProject",
  },
  {
    id: FeatureId.ParseMultiVoice,
    title: "四声部解析",
    description: "从 Voice 段拆分 1 至 4 个声部时间线，生成可播放、可导出的标准事件列表。",
    status: FeatureStatus.Implemented,
    interfaceName: "parseVoiceSegments",
  },
  {
    id: FeatureId.MultiVoicePlayback,
    title: "多声部组合播放",
    description: "播放时不再限制单声部，可勾选任意 1 至 4 个声部一起播放。",
    status: FeatureStatus.Implemented,
    interfaceName: "playProjectSelection",
  },
  {
    id: FeatureId.VoiceMixing,
    title: "声部乐器与音量控制",
    description: "每个声部单独选择乐器音色和音量，组成导出与播放时的混音配置。",
    status: FeatureStatus.Implemented,
    interfaceName: "VoicePlaybackSettings",
  },
  {
    id: FeatureId.VoiceSubsetPlayback,
    title: "任意声部子集导出",
    description: "MIDI、MusicXML、MP3 三种导出均支持任意勾选声部子集。",
    status: FeatureStatus.Implemented,
    interfaceName: "buildMidiFile / buildMusicXml / renderMp3Blob",
  },
  {
    id: FeatureId.ClickToSeek,
    title: "点击谱面跳播",
    description: "点击时间轴上的任意音符块或区域，立即定位并从该位置继续播放。",
    status: FeatureStatus.Implemented,
    interfaceName: "seekPlayback",
  },
  {
    id: FeatureId.ExportMidi,
    title: "MIDI 导出",
    description: "将所选声部导出为标准 MIDI 文件，保留速度、分轨与音高。",
    status: FeatureStatus.Implemented,
    interfaceName: "buildMidiFile",
  },
  {
    id: FeatureId.ExportMusicXml,
    title: "MusicXML 导出",
    description: "将所选声部导出为 partwise MusicXML 文件，方便进入其他制谱软件继续编辑。",
    status: FeatureStatus.Implemented,
    interfaceName: "buildMusicXml",
  },
  {
    id: FeatureId.ExportMp3,
    title: "MP3 导出",
    description: "使用浏览器内离线渲染和 MP3 编码，将选中声部直接导出为 MP3。",
    status: FeatureStatus.Implemented,
    interfaceName: "renderMp3Blob",
  },
  {
    id: FeatureId.FeaturePool,
    title: "功能池说明",
    description: "在界面内和文档内同时列出功能枚举号、接口名与实现状态。",
    status: FeatureStatus.Implemented,
    interfaceName: "featurePool",
  },
];
