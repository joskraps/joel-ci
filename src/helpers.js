const request = require('request');
const url = require('url');
const exec = require('child_process').exec;
    // , spawn = require("child_process").spawn
const path = require('path');
const winston = require('winston');
const fse = require('fs-extra');

module.exports = {
  runTask(command, root, logger) {
    const promiseFromChildProcess = function promiseFromChildProcess(child) {
      return new Promise((resolve, reject) => {
        child.addListener('error', (code) => {
          reject(code);
        });
        child.addListener('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject();
          }
        });
      });
    };

    const com = exec(command, { cwd: root, env: process.env });

    com.stdout.on('data', (data) => {
      logger.info(data.toString());
    });

    com.stderr.on('data', (data) => {
      logger.warn(data.toString());
    });

    com.on('exit', (data) => {
      logger.info(`Exit with code ${data}`);
    });

    return promiseFromChildProcess(com);
  },
  updateStatus(statusUrl, status, message, target, callback) {
    request.post(statusUrl, {
      json: true,
      body: {
        state: status,
        description: message,
        context: 'continuous-integration/joel-ci',
        target_url: target,
      },
    }, (error, response, body) => {
      if (callback) callback(error, response, body);

      return false;
    });
  },
  formatStatusUrl(baseUrl, sha, config) {
    const formattedUrl = url.parse(baseUrl.replace('{sha}', sha), false, true);
    formattedUrl.auth = `${config.authUser}:${config.authToken}`;
    const postUrl = `${formattedUrl.protocol}//${formattedUrl.auth}@${formattedUrl.hostname}${formattedUrl.path}`;

    return postUrl;
  },
  parseRequestConfig(ref, repo, data, config) {
    const options = {};
    const splitRef = ref.split('/');

    options.branchName = splitRef[splitRef.length - 1];
    options.repo = repo;
    options.ref = ref;
    options.sha1 = data.after;
    options.branchFullPath = path.join(config.rootDir, repo, options.branchName, options.sha1);
    options.postUrl = this.formatStatusUrl(data.repository.statuses_url, data.after, config);
    options.repoUrl = data.repository.html_url;

    return options;
  },
  setupLogging(reqConfig, logFilePath) {
    const logger = new winston.Logger();
    logger.level = process.env.LOG_LEVEL || 'info';

    const finalLogPath = path.join(logFilePath, reqConfig.repo, reqConfig.branchName, `${reqConfig.sha1}.log`);

    if(fse.exists(finalLogPath)) {
        fse.unlinkSync(finalLogPath);
    }

    fse.ensureFileSync(finalLogPath);

    logger.configure({
      transports: [
        new (winston.transports.File)({ json: false, filename: finalLogPath }),
      ],
    });

    return logger;
  }
};
