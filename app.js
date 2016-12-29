const Promise = require('bluebird');
const helpers = require('./src/helpers.js');
const githubhook = require('githubhook');
const nodegit = require('nodegit');
const fse = require('fs-extra');
const removeAll = Promise.promisify(require('fs-extra').remove);
const ensureDir = Promise.promisify(require('fs-extra').ensureDir);
const walk = require('walk').walk;
const path = require('path');
const config = require('./server-config.js');
const resultServer = require('./src/ci-results.js');

const logFolder = path.join(config.rootDir, 'logs');
const updateStatus = Promise.promisify(helpers.updateStatus);
const github = githubhook(config.gitHubHookConfig);

if (!fse.existsSync(config.rootDir)) {
  fse.mkdirSync(config.rootDir);
}

global.appRoot = path.resolve(__dirname);


github.on('push', (repo, ref, data) => {
  const reqConfig = helpers.parseRequestConfig(ref, repo, data, config);
  const logger = helpers.setupLogging(reqConfig, logFolder);
  const targetUrlHost = config.resultsProtocol + data.request.headers.host.split(':')[0] // this needs to pull from the config
    .concat(':')
    .concat(config.resultsPort)
    .concat('/results')
    .concat(`?repo=${repo}`)
    .concat(`&branch=${reqConfig.branchName}`)
    .concat(`&commit=${reqConfig.sha1}`);

  logger.info(`Received push from ${repo}:${ref}`);
  logger.info(`Target URL:  ${targetUrlHost}`);

  if (ref.indexOf('ci-test') === -1) return 'boomer';

  logger.info('Request config loaded: ', reqConfig);

  logger.profile(reqConfig.sha1);
  updateStatus(reqConfig.postUrl, 'pending', 'Running tasks', null).then((updateResponse) => {
    logger.info(`Update status complete: ${updateResponse.statusCode} ${updateResponse.statusMessage}`);
    logger.info(`Removing existing folder @ ${reqConfig.branchFullPath}`);

    return removeAll(reqConfig.branchFullPath);
  })
    .then((removeError) => {
      if (removeError) throw removeError;
      logger.info(`Creating clone directory @ ${reqConfig.branchFullPath}`);
      return ensureDir(reqConfig.branchFullPath);
    })
    .then((createdPath) => {
      logger.info(`Cloning from ${reqConfig.repoUrl} - checkout branch is ${reqConfig.branchName}`);

      let cloneOptions = new nodegit.CloneOptions();

      cloneOptions.checkoutBranch = reqConfig.branchName;

      return nodegit.Clone(reqConfig.repoUrl, createdPath, cloneOptions);
    })
    .then(repo2 => new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
      const items = [];
      const walker = walk(reqConfig.branchFullPath, {
        followLinks: false,
        filters: config.ignoreDirs,
      });

      walker.on('file', (root, fileStat, next) => {
        if (fileStat.type === 'file' && fileStat.name.toLowerCase() === config.configFileName) {
          fse.readFile(`${root}\\${fileStat.name}`, (err, data2) => {
            if (err) throw err;

            logger.info(`Found config @  ${root}`);

            items.push({
              path: root,
              name: fileStat.name,
              config: JSON.parse(data2),
            });
          });
        }
        next();
      });
      walker.on('errors', (root, nodeStatsArray, next) => {
        next();
      });
      walker.on('end', () => {
        resolve(items);
      });
    }))
    .then(configFiles =>
      Promise.reduce(configFiles, (tot, curConfig) =>
        Promise.reduce(curConfig.config.scripts, (innerIndex, curCommand) => {
          logger.info(`Running script:  ${curCommand} @ path ${curConfig.path}`);

          return helpers.runTask(curCommand, curConfig.path, logger);
        }, 0), 0))
    .then(() => {
      logger.info('All tasks completed');
      helpers.updateStatus(reqConfig.postUrl, 'success', 'all tasks completed successfully', targetUrlHost);
    })
    .catch((ex) => {
      logger.error('Error executing task(s)', ex);
      helpers.updateStatus(reqConfig.postUrl, 'failure', 'error executing task(s)', targetUrlHost);
    })
    .finally(() => {
    })
    .done(() => {
      logger.profile(reqConfig.sha1);
      logger.info(`All done for ${reqConfig.sha1}`);
      // clean up folder to save space
      return true; // removeAll(reqConfig.branchFullPath);
    });

  return true;
});

github.listen();
resultServer.setupResultsServer(logFolder);
