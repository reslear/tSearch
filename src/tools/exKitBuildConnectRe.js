import urlPatternToStrRe from './urlPatternToStrRe.js';


const exKitBuildConnectRe = connect => {
  const connectRe = [];
  if (connect) {
    connect.forEach(function (patter) {
      try {
        connectRe.push(...urlPatternToStrRe(patter));
      } catch (err) {
        console.error('Connect pattern error!', patter, err);
      }
    });
  }
  if (connectRe.length) {
    return new RegExp(connectRe.join('|'), 'i');
  } else {
    return null;
  }
};

export default exKitBuildConnectRe;