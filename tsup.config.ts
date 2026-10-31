import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { logic: 'logic/index.ts' },
  format: ['esm'],
  dts: false,
  clean: true,
  // SDK 由宿主提供，不打进产物
  external: ['@nexusgame/game-sdk'],
  outDir: 'dist',
  target: 'node18',
  outExtension() {
    return { js: '.mjs' };
  },
});
