import explorerModulesJson from '../explorers.json';

let cache = null;

const getExplorerModulesJson = async () => {
  if (cache) {
    return cache;
  } else {
    return cache = explorerModulesJson; // fetch('./explorers.json').then(r => r.json());
  }
};

export default getExplorerModulesJson;
