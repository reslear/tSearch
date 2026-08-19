import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadGetExploreSectionCodeMeta = async () => {
  const modulePath = pathToFileURL(path.resolve(__dirname, '../src/tools/getExploreModuleCodeMeta.js')).href;
  return (await import(modulePath)).default;
};

const buildExplorersJson = async () => {
  const getExploreSectionCodeMeta = await loadGetExploreSectionCodeMeta();
  const place = path.resolve(__dirname, '../src/explorerModules');
  const files = await readdir(place);

  const trackerIds = files
    .filter(filename => /.+\.js$/.test(filename))
    .map(filename => filename.slice(0, -3));

  const results = await Promise.all(trackerIds.sort().map(async (id) => {
    const code = await readFile(path.resolve(place, `${id}.js`));
    return {id, version: getExploreSectionCodeMeta(code.toString()).version};
  }));

  const trackers = {};
  results.forEach(({id, version}) => {
    trackers[id] = version;
  });

  await writeFile(
    path.resolve(__dirname, '../src/explorers.json'),
    `${JSON.stringify(trackers, null, 2)}\n`
  );
};

buildExplorersJson().catch(error => {
  console.error(error);
  process.exit(1);
});
