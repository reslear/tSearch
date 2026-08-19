import {getSnapshot, getType, isArrayType, isMapType, isStateTreeNode, resolvePath} from "mobx-state-tree";
import {compare} from "fast-json-patch";

const getParentPath = (path) => {
  return path.substr(0, path.lastIndexOf('/'));
};

/**
 * fast-json-patch walks own enumerable properties. A live mobx-state-tree node
 * exposes internal observable machinery there, which produced bogus patches
 * (e.g. "/changeListeners"). Always diff against a plain snapshot instead.
 */
const toPlainValue = (value) => {
  if (isStateTreeNode(value)) {
    return JSON.parse(JSON.stringify(getSnapshot(value)));
  }
  return value;
};

const resolvePathSafe = (node, path) => {
  try {
    return resolvePath(node, path);
  } catch (err) {
    return undefined;
  }
};

const mobxCompare = (mobxOldValue, newValue) => {
  const oldValue = toPlainValue(mobxOldValue);

  return compare(oldValue, newValue).filter((patch) => {
    if (patch.op === 'remove') {
      const value = resolvePathSafe(mobxOldValue, patch.path);
      if (value === undefined) {
        return false;
      }

      const placePath = getParentPath(patch.path);
      if (placePath !== patch.path) {
        const place = resolvePathSafe(mobxOldValue, placePath);
        if (place === undefined) {
          return false;
        }
        const placeType = getType(place);
        if (!isArrayType(placeType) && !isMapType(placeType)) {
          patch.op = 'replace';
          patch.value = undefined;
        }
      }
    }
    return true;
  });
};

export default mobxCompare;
