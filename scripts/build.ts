import { rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
await rm('dist', { recursive: true, force: true });

const args = ['build', './index.html', '--outdir', 'dist'];
if (!watch) args.push('--minify');
if (watch) args.push('--watch');

const build = Bun.spawn([process.execPath, ...args], { stdout: 'inherit', stderr: 'inherit' });
process.exitCode = await build.exited;
