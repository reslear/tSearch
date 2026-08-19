import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadGetTrackerCodeMeta = async () => {
  const modulePath = pathToFileURL(path.resolve(__dirname, '../src/tools/getTrackerCodeMeta.js')).href;
  return (await import(modulePath)).default;
};

const buildTrackersJson = async () => {
  const getTrackerCodeMeta = await loadGetTrackerCodeMeta();
  const place = path.resolve(__dirname, '../src/trackers');
  const files = await readdir(place);

  const trackerIds = files
    .filter(filename => /.+\.js$/.test(filename))
    .map(filename => filename.slice(0, -3));

  const results = await Promise.all(trackerIds.sort().map(async (id) => {
    const code = await readFile(path.resolve(place, `${id}.js`));
    return {id, version: getTrackerCodeMeta(code.toString()).version};
  }));

  const trackers = {};
  results.forEach(({id, version}) => {
    trackers[id] = version;
  });

  await writeFile(
    path.resolve(__dirname, '../src/trackers.json'),
    `${JSON.stringify(trackers, null, 2)}\n`
  );
};

buildTrackersJson().catch(error => {
  console.error(error);
  process.exit(1);
});
