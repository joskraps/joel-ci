var Promise = require('bluebird'),
    helpers = require('./helpers.js'),
    githubhook = require('githubhook'),
    nodegit = require("nodegit"),
    fse = require('fs-extra'),
    removeAll = Promise.promisify(require('fs-extra').remove),
    ensureDir = Promise.promisify(require('fs-extra').ensureDir),
    updateStatus = Promise.promisify(helpers.updateStatus),
    walk = require('walk').walk,
    path = require('path');

var config = require('./server-config.js');
var github = githubhook(config.gitHubHookConfig);
var logFolder = path.join(config.rootDir, 'logs');

if (!fse.existsSync(config.rootDir)) {
    fse.mkdirSync(config.rootDir);
}



github.on('push', function (repo, ref, data) {
    var reqConfig = helpers.parseRequestConfig(ref, repo, data, config);
    var logger = helpers.setupLogging(reqConfig,logFolder);

    logger.info(`Received push from ${repo}:${ref}`);

    if (ref.indexOf('ci-test') == -1) return "boomer";

    var reqConfig = helpers.parseRequestConfig(ref, repo, data, config);
    logger.info('Request config loaded: ', reqConfig);

    logger.profile(reqConfig.sha1);
    updateStatus(reqConfig.postUrl, "pending", "Running tasks").then(function (updateResponse) {
        logger.info(`Update status complete: ${updateResponse.statusCode} ${updateResponse.statusMessage}`);
        logger.info(`Removing existing folder @ ${reqConfig.branchFullPath}`);

        return removeAll(reqConfig.branchFullPath);
    }).then(function (removeError) {
        if (removeError) throw removeError;
        logger.info(`Creating clone directory @ ${reqConfig.branchFullPath}`);
        return ensureDir(reqConfig.branchFullPath);
    }).then(function (createdPath) {
        logger.info(`Cloning from ${reqConfig.repoUrl} - checkout branch is ${reqConfig.branchName}`);

        var cloneOptions = new nodegit.CloneOptions();

        cloneOptions.checkoutBranch = reqConfig.branchName;

        return nodegit.Clone(reqConfig.repoUrl, createdPath, cloneOptions);
    }).then(function (repo) {
        return new Promise(function (resolve, reject) {
            var items = [];
            var walker = walk(reqConfig.branchFullPath, {
                followLinks: false, filters: config.ignoreDirs
            });

            walker.on("file", function (root, fileStat, next) {
                if (fileStat.type === "file" && fileStat.name.toLowerCase() === config.configFileName) {
                    fse.readFile(`${root}\\${fileStat.name}`, function (err, data) {
                        if (err) throw err;
                        logger.info(`Found config @  ${root}`);
                        items.push({ "path": root, "name": fileStat.name, "config": JSON.parse(data) });
                    });
                }
                next();
            });
            walker.on("errors", function (root, nodeStatsArray, next) {
                next();
            });
            walker.on("end", function () {
                resolve(items);
            });
        });
    }).then(function (configFiles) {
        return Promise.reduce(configFiles, function (tot, curConfig) {
            return Promise.reduce(curConfig.config.scripts, function (innerIndex, curCommand) {
                logger.info(`Running script:  ${curCommand} @ path ${curConfig.path}`);
                return helpers.runTask(curCommand, curConfig.path,logger);
            }, 0)
        }, 0);
    }).then(function () {
        logger.info('All tasks completed');
        helpers.updateStatus(reqConfig.postUrl, "success", "all tasks completed successfully");
    }).catch(function (ex) {
        logger.error(`Error executing task(s)`, ex);
        helpers.updateStatus(reqConfig.postUrl, "failure", "error executing task(s)");
    }).finally(function () {

    }).done(function () {
        logger.profile(reqConfig.sha1);
        logger.info(`All done for ${reqConfig.sha1}`);
        // clean up folder to save space
        return removeAll(reqConfig.branchFullPath);
    });
});

github.listen();