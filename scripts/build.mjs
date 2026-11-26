import { mkdir, copyFile } from 'node:fs/promises';
const files = ['index.html', 'src/app.js', 'src/core.js', 'src/style.css', 'src/split.css', 'examples/platform.json'];
for (const file of files) {
  const destination = new URL('../dist/' + file, import.meta.url);
  await mkdir(new URL('./', destination), { recursive: true });
  await copyFile(new URL('../' + file, import.meta.url), destination);
}
console.log('Static site built in dist/');
