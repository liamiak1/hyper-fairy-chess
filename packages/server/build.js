import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true,
  // Bundle workspace packages, externalize node_modules
  external: [
    'express',
    'socket.io',
    'cors',
    'http',
    'path',
    'fs',
    'url',
  ],
});

console.log('Server built successfully!');
