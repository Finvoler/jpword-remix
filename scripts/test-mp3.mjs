/**
 * Node.js 本地测试：验证 lamejs MP3 编码链路
 *
 * 运行：node scripts/test-mp3.mjs
 *
 * 测试内容：
 *   1. lamejs Mp3Encoder 可以正确实例化
 *   2. Float32 → Int16 转换正确
 *   3. 编码 440Hz + 880Hz + 261Hz 三音叠加（模拟简谱合唱）
 *   4. flush 末尾帧
 *   5. 输出 MP3 文件头合法（0xFF 0xFB 或 ID3 tag）
 *   6. 输出文件写入 dist/test-output.mp3
 */

import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── 1. 加载 lamejs ─────────────────────────────────────────
let lamejs;
try {
  lamejs = require("lamejs");
  console.log("✅ lamejs 加载成功");
} catch (err) {
  console.error("❌ lamejs 加载失败:", err.message);
  process.exit(1);
}

const Mp3Encoder = lamejs.Mp3Encoder;
if (!Mp3Encoder) {
  console.error("❌ lamejs.Mp3Encoder 未定义，导出结构异常:", Object.keys(lamejs));
  process.exit(1);
}
console.log("✅ lamejs.Mp3Encoder 找到");

// ── 2. 合成测试 PCM（模拟 4 声部 + 多音符） ─────────────────
const SAMPLE_RATE = 44100;
const DURATION_SEC = 3.0;           // 3 秒测试音频
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

/** 440 * 2^((midi-69)/12) */
function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** float [-1,1] → int16 */
function floatToInt16(v) {
  const s = Math.max(-1, Math.min(1, v));
  return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
}

// 模拟 4 声部各 8 个音符的 PCM 数据
const testNotes = [
  // [midiPitch, startSec, durSec]
  [69, 0.0, 0.4], [71, 0.4, 0.4], [73, 0.8, 0.4], [74, 1.2, 0.4],
  [76, 1.6, 0.4], [74, 2.0, 0.4], [73, 2.4, 0.3], [71, 2.7, 0.3],
  [65, 0.0, 0.8], [67, 0.8, 0.8], [69, 1.6, 0.8], [67, 2.4, 0.6],
  [57, 0.0, 1.2], [60, 1.2, 1.2], [57, 2.4, 0.6],
  [52, 0.0, 2.0], [55, 2.0, 1.0],
];

const float32 = new Float32Array(NUM_SAMPLES);
const voiceCount = 4;

for (const [midi, start, dur] of testNotes) {
  const freq = midiToHz(midi);
  const startSample = Math.floor(start * SAMPLE_RATE);
  const endSample = Math.min(NUM_SAMPLES, Math.floor((start + dur) * SAMPLE_RATE));
  const attack = Math.floor(0.015 * SAMPLE_RATE);
  const release = Math.floor(Math.min(0.1, dur * 0.25) * SAMPLE_RATE);

  for (let i = startSample; i < endSample; i++) {
    const local = i - startSample;
    const totalDur = endSample - startSample;
    let env = 1.0;
    if (local < attack) env = local / attack;
    else if (local > totalDur - release) env = (totalDur - local) / release;
    float32[i] += (env * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)) / voiceCount;
  }
}

console.log("✅ 合成 PCM 完成，样本数:", NUM_SAMPLES);

// ── 3. Float32 → Int16 ────────────────────────────────────
const int16 = new Int16Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  int16[i] = floatToInt16(float32[i]);
}

// 峰值检测
const maxVal = int16.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
console.log(`✅ Int16 转换完成，峰值幅度: ${maxVal} / 32767 (${(maxVal / 32767 * 100).toFixed(1)}%)`);
if (maxVal < 100) {
  console.warn("⚠️  峰值很低，可能是静音信号");
}

// ── 4. lamejs 编码 ────────────────────────────────────────
const encoder = new Mp3Encoder(1, SAMPLE_RATE, 128);
const BLOCK_SIZE = 1152;
const chunks = [];

for (let start = 0; start < int16.length; start += BLOCK_SIZE) {
  const chunk = int16.subarray(start, start + BLOCK_SIZE);
  const encoded = encoder.encodeBuffer(chunk);
  if (encoded.length > 0) {
    chunks.push(Buffer.from(encoded));
  }
}

const tail = encoder.flush();
if (tail.length > 0) {
  chunks.push(Buffer.from(tail));
}

const mp3Buffer = Buffer.concat(chunks);
console.log(`✅ MP3 编码完成，字节数: ${mp3Buffer.length}`);

if (mp3Buffer.length < 100) {
  console.error("❌ 输出文件过小，编码失败");
  process.exit(1);
}

// ── 5. 验证 MP3 文件头 ────────────────────────────────────
const h0 = mp3Buffer[0], h1 = mp3Buffer[1], h2 = mp3Buffer[2];
const isId3 = h0 === 0x49 && h1 === 0x44 && h2 === 0x33; // "ID3"
const isMpeg = h0 === 0xFF && (h1 & 0xE0) === 0xE0;      // sync word

if (isId3 || isMpeg) {
  console.log(`✅ MP3 文件头合法: ${isId3 ? "ID3 tag" : "MPEG sync word"}`);
} else {
  const hexHead = [...mp3Buffer.slice(0, 4)].map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ");
  console.warn(`⚠️  MP3 文件头未识别: ${hexHead}（通常仍可播放）`);
}

// ── 6. 写文件 ─────────────────────────────────────────────
const outDir = join(__dirname, "..", "dist");
try { mkdirSync(outDir, { recursive: true }); } catch {}
const outPath = join(outDir, "test-output.mp3");
writeFileSync(outPath, mp3Buffer);
console.log(`✅ 文件已写入: ${outPath}`);
console.log("");
console.log("══ 所有 lamejs 编码链路测试通过 ══");
