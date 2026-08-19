import storageGet from "./storageGet";
import storageSet from "./storageSet";

let uuidCache = null;

const createUserId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getUserId = () => {
  if (uuidCache) {
    return Promise.resolve(uuidCache);
  }
  return storageGet('uuid').then(storage => {
    if (!storage.uuid) {
      storage.uuid = createUserId();
      return storageSet(storage).then(() => storage.uuid);
    } else {
      return storage.uuid;
    }
  }).then(uuid => {
    return uuidCache = uuid;
  });
};

export default getUserId;
