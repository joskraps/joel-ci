var Promise = require('bluebird'),
    githubhook = require('githubhook'),
    exec = require('child_process').exec,
    nodegit = require("nodegit"),
    path = require('path'),
    fse = require("fs-extra"),
    util = require('util'),
    http = require('http'),
    request = require('request'),
    url = require('url'),
    walk = require('walk');

var helpers = require('./helpers.js');
var config = require('./server-config.js');
var github = githubhook(config.gitHubHookConfig);

if (!fse.existsSync(config.rootDir)) {
    fse.mkdirSync(config.rootDir);
}

NPM_CONFIG_COLOR = "always";

github.on('*', function (event, repo, ref, data) {

    if (event === "ping") return "pong";
    if (event == "pull_request") return "boom";
    if (ref.indexOf('joel-ci') == -1) return "boomer";

    var splitBranch = ref.split("/"),
        branchName = splitBranch[splitBranch.length - 1],
        sha1 = data.after,
        cloneOptions = new nodegit.CloneOptions(),
        branchPathFull = path.join(config.rootDir, repo, branchName),
        postUrl = helpers.formatStatusUrl(data.repository.statuses_url, data.after, config);

    cloneOptions.checkoutBranch = branchName;

    helpers.updateStatus(postUrl, "pending", "Running tasks", function (error, response, body) {
        console.log('Cleaning');
        fse.remove(branchPathFull, function (err) {
            if (err) {
                helpers.updateStatus(postUrl, "failure", err, function (error, response, body) {
                });
                return console.error(err)
            }

            console.log('Creating');
            fse.ensureDir(branchPathFull, function (err2) {
                if (err2) {
                    helpers.updateStatus(postUrl, "failure", err, function (error, response, body) {
                    });
                    return console.error(err2)
                }
                console.log('Cloning');
                nodegit.Clone(data.repository.html_url, branchPathFull, cloneOptions)
                    .then(function (repo) {
                        console.log('Updating status');

                        var items = [];
                        var walker = walk.walk(branchPathFull, {
                            followLinks: false, filters: ["Temp", "_Temp", "node_modules", "bin", "obj", ".vscode", ".git"]
                        });

                        walker.on("file", function (root, fileStat, next) {
                            if (fileStat.type === "file" && fileStat.name.toLowerCase() === "joel-ci.json") {
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
                            var goodToGo = true;

                            Promise.reduce(items, function (tot, curConfig, ind, len) {
                                return Promise.reduce(curConfig.config.scripts, function (ind, curCommand) {
                                    return helpers.runTask(curCommand, curConfig.path, process.env);
                                }, 0)
                            }, 0).then(() => {
                                console.log('ALL TESTS RAN SUCCESSFULLY!');
                                helpers.updateStatus(postUrl, "success", "all tasks completed successfully", function (error, response, body) {
                                    console.log('Done for ' + sha1);
                                });
                            }).catch((ex) => {
                                console.log(ex);
                                console.log('SOME TESTS OR SOMETHING IN THE SAUCE STACK HAS FAILED!');
                                helpers.updateStatus(postUrl, "failure", "error executing task(s)", function (error, response, body) {
                                    console.log('Done for ' + sha1);
                                });
                            });
                        });
                    }, function (failure) {
                        console.log(failure);
                    })
                    .done(function () {
                        console.log('Processing ' + sha1);
                    });
            });
        })
    });
});

github.listen();