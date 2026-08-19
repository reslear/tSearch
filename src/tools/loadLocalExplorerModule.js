import getExploreModuleCodeMeta from "./getExploreModuleCodeMeta.js";

const loadLocalExplorerModule = id => {
  return fetch(chrome.runtime.getURL('src/explorerModules/' + id + '.js')).then(response => {
    return response.text();
  }).then(response => {
    return {
      id: id,
      meta: getExploreModuleCodeMeta(response),
      code: response,
    }
  });
};

export default loadLocalExplorerModule;
