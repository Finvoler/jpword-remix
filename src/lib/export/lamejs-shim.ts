/**
 * lamejs shim — loads lame.all.js (the pre-bundled single-file version) via
 * Vite's ?raw import, then evaluates it in an isolated Function scope.
 *
 * Why: the lamejs npm entry point (src/js/index.js) is a CJS file that
 * references variables like `MPEGMode` which are only in scope inside the
 * lame.all.js IIFE. Vite's ESM transform breaks those cross-file globals,
 * causing "MPEGMode is not defined" at runtime.
 *
 * lame.all.js structure:
 *   function lamejs() { ...all code...; lamejs.Mp3Encoder = Mp3Encoder; }
 *   lamejs();
 *
 * After the IIFE fires, the `lamejs` function has .Mp3Encoder attached.
 * We evaluate it in a Function scope and return `lamejs` to extract it.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — ?raw is a Vite-specific import modifier
import lameSource from "lamejs/lame.all.js?raw";

export type LameEncoder = {
  encodeBuffer: (buffer: Int16Array) => Int8Array;
  flush: () => Int8Array;
};

type LamejsLib = {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameEncoder;
};

// Evaluate lame.all.js in its own Function scope so its internal variables
// (MPEGMode, Encoder, etc.) stay in scope for each other.
// After lamejs() runs, the function object has .Mp3Encoder set on it.
// eslint-disable-next-line no-new-func
const lamejsLib = (new Function(`${lameSource as string}; return lamejs;`) as () => LamejsLib)();

export const Mp3Encoder = lamejsLib.Mp3Encoder;
