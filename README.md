# JPWord Remix

JPWord Remix 是一个面向 `.jpwabc` 的本地替代应用，用来补齐旧版 JP-Word 已缺失的导出与多声部控制能力。

## 已实现

- 导入 UTF-16 `.jpwabc` 工程文本
- 解析 1 到 4 个声部的时间线事件
- 任意勾选声部组合播放
- 每个声部单独设置乐器和音量
- 点击谱面时间轴跳转播放位置
- 导出选中声部到 MIDI
- 导出选中声部到 MusicXML
- 导出选中声部到 MP3
- 功能池与接口枚举号面板

## 启动

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 说明

- 当前版本直接从 `.Voice` 段重建音符事件，不依赖原 exe。
- 调号使用 `KeyAndMeters = {1=...,x/y}` 中的主音和拍号信息。
- BPM 若文件内未提供显式速度字段，则默认使用 88 BPM。
- MusicXML 目前输出单声部 partwise 结构，适合作为后续继续整理和换谱入口。
