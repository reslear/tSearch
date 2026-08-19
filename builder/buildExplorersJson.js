require('./defaultBuildEnv');

const {readdir, readFile, writeFile} = require('node:fs/promises');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');

const loadGetExploreSectionCodeMeta = async () => {
  const modulePath = pathToFileURL(resolve(__dirname, '../src/tools/getExploreModuleCodeMeta.js')).href;
  return (await import(modulePath)).default;
};

const buildExplorersJson = async () => {
  const getExploreSectionCodeMeta = await loadGetExploreSectionCodeMeta();
  const place = resolve(__dirname, '../src/explorerModules');
  const files = await readdir(place);

  const trackerIds = files
    .filter(filename => /.+\.js$/.test(filename))
    .map(filename => filename.slice(0, -3));

  const results = await Promise.all(trackerIds.sort().map(async (id) => {
    const code = await readFile(resolve(place, `${id}.js`));
    return {id, version: getExploreSectionCodeMeta(code.toString()).version};
  }));

  const trackers = {};
  results.forEach(({id, version}) => {
    trackers[id] = version;
  });

  await writeFile(
    resolve(__dirname, '../src/explorers.json'),
    `${JSON.stringify(trackers, null, 2)}\n`
  );
};

buildExplorersJson().catch(error => {
  console.error(error);
  process.exit(1);
});
