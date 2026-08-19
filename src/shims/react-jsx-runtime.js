import React from 'react';

export function jsx(type, props, key) {
  const { children, ...rest } = props || {};
  const finalProps = { ...rest };
  if (key !== undefined) {
    finalProps.key = key;
  }
  return React.createElement(type, finalProps, children);
}

export function jsxs(type, props, key) {
  return jsx(type, props, key);
}

export const Fragment = React.Fragment;

export function jsxDEV(type, props, key) {
  return jsx(type, props, key);
}
