import FrameWorker from "./frameWorker.js";
import exKitRequest from "./exKitRequest.js";
import exKitBuildConnectRe from "./exKitBuildConnectRe.js";
import getLogger from "./getLogger.js";

const logger = getLogger('moduleWorker');

class ModuleWorker {
  constructor(module, profileOptions) {
    this.module = module;
    this.profileOptions = null;

    this.worker = null;

    this.requests = [];

    this.connectRe = null;

    this.setProfileOptions(profileOptions);

    this.api = {
      request: (details) => {
        return exKitRequest(this, details);
      }
    };
  }
  init() {
    const module = this.module;
    this.connectRe = exKitBuildConnectRe(module.meta.connect);
    this.worker = new FrameWorker({
      moduleId: module.id
    }, this.api);
    const info = {
      locale: module.meta.locale
    };
    return this.worker.callFn('init', [module.code, module.meta.require, info]).catch(err => {
      this.destroyWorker();
      throw err;
    });
  }
  setProfileOptions(profileOptions) {
    this.profileOptions = profileOptions || {};
  }
  callFn(event, args) {
    return this.worker.callFn(event, args);
  }
  abortAllRequests() {
    this.requests.splice(0).forEach(req => {
      req.abort();
    });
  }
  destroyWorker() {
    if (this.worker) {
      this.worker.destroy();
      this.worker = null;
    }
  }
  destroy() {
    this.destroyWorker();
    this.abortAllRequests();
  }
}

export default ModuleWorker;