import path from 'node:path';
import fs from 'node:fs';
import archiver from 'archiver';
import { BUILD_ENV } from './defaultBuildEnv.mjs';

const compressDist = () => {
  const ext = 'zip';
  const dist = BUILD_ENV.outputPath;
  const outputPath = BUILD_ENV.outputPath;

  const zipFolder = (srcFolder, zipFilePath, callback) => {
    const output = fs.createWriteStream(zipFilePath);
    const zipArchive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', function() {
      callback();
    });

    zipArchive.pipe(output);

    zipArchive.glob('**/*', {
      cwd: srcFolder
    });

    zipArchive.finalize(function(err, bytes) {
      if (err) {
        callback(err);
      }
    });
  };

  return new Promise((resolve, reject) => {
    zipFolder(dist, path.join(outputPath, `${BUILD_ENV.distName}.${ext}`), err => {
      err ? reject(err) : resolve();
    });
  });
};

compressDist();
