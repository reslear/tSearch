import React from 'react';
import {BUILD_ENV} from "../tools/buildEnv";

const getBuildDate = () => {
  if (!BUILD_ENV || !BUILD_ENV.buildTime) {
    return 'неизвестно';
  }

  const date = new Date(BUILD_ENV.buildTime);
  if (Number.isNaN(date.getTime())) {
    return BUILD_ENV.buildTime;
  }

  return date.toLocaleString();
};

const BuildMeta = () => {
  return (
    <div className="build-meta">
      <span className="build-meta__text">
        v{BUILD_ENV.version} · {getBuildDate()}
      </span>
    </div>
  );
};

export default BuildMeta;
