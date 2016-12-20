var Promise = require('bluebird'),
    helpers = require('./helpers.js'),
    githubhook = require('githubhook'),
    nodegit = require("nodegit"),
    path = require('path'),
    fse = require('fs-extra'),
    removeAll = Promise.promisify(require('fs-extra').remove),
    ensureDir = Promise.promisify(require('fs-extra').ensureDir),
    updateStatus = Promise.promisify(helpers.updateStatus),
    walk = require('walk').walk;

var config = require('./server-config.js');
var github = githubhook(config.gitHubHookConfig);
var winston = require('winston');

if (!fse.existsSync(config.rootDir)) {
    fse.mkdirSync(config.rootDir);
}

NPM_CONFIG_COLOR = "always";

github.on('*', function (event, repo, ref, data) {

    if (event === "ping") return "pong";
    if (event == "pull_request") return "boom";
    if (ref.indexOf('ci-test') == -1) return "boomer";

    var reqConfig = helpers.parseRequestConfig(ref,repo,data,config);

    //initial update
    updateStatus(reqConfig.postUrl, "pending", "Running tasks").then(function (updateResponse) {
        return removeAll(reqConfig.branchFullPath);
    }).then(function (removeError) {
        if(removeError) throw removeError;

        return ensureDir(reqConfig.branchFullPath);
    }).then(function (createdPath) {
        return nodegit.Clone(data.repository.html_url, reqConfig.branchFullPath, reqConfig.cloneOptions);
    }).then(function (repo) {
        return new Promise(function (resolve,reject) {
            var items = [];
            var walker = walk(branchPreqConfig.branchFullPathathFull, {
                followLinks: false, filters: config.ignoreDirs
            });

            walker.on("file", function (root, fileStat, next) {
                if (fileStat.type === "file" && fileStat.name.toLowerCase() === config.configFileName) {
                    fse.readFile(`${root}\\${fileStat.name}`, function (err, data) {
                        if (err) throw err;
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
                return helpers.runTask(curCommand, curConfig.path, process.env);
            }, 0)
        }, 0);
    }).then(function () {
        helpers.updateStatus(reqConfig.postUrl, "success", "all tasks completed successfully");
    }).catch(function (ex) {
        helpers.updateStatus(reqConfig.postUrl, "failure", "error executing task(s)");
    }).finally(function () {
    }).done(function () {
        console.log('Done for ' + reqConfig.sha1);
    });
});

github.listen();