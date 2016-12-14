var Promise = require('bluebird');
var githubhook = require('githubhook');
var exec = require('child_process').exec;
var nodegit = require("nodegit");
var path = require('path');
var fse = require("fs-extra");
var util = require('util');
var http = require('http');
var request = require('request');
var url = require('url');

//var helpers = require('./helpers.js');
var config = require('./server-config.js');
//var cpp = require('./childProcessPromise.js');
var github = githubhook(config.gitHubHookConfig);

function payloadGenerator(status, description) {
    var payload = {
        "state": status,
        "description": description,
        "context": "continuous-integration/joel-ci"
    };

    return payload;
}

if (!fse.existsSync(config.rootDir)) {
    fse.mkdirSync(config.rootDir);
}

function runTask(command, root, env) {
    console.log(`Path: ${root} Command: ${command}`);

    var local = exec(command, {
        cwd: root,
        env: env
    });
    local.stdout.on('data', function(data) {
        console.log(data)
    });
    local.stderr.on('data', function(data) {
        console.log(data)
    });
    return promiseFromChildProcess(local);
}

function promiseFromChildProcess(child) {
    return new Promise((resolve, reject) => {
        child.addListener('error', (code, signal) => {
            console.log('ChildProcess error', code, signal);
            reject();
        });
        child.addListener('exit', (code, signal) => {
            console.log(`Exit code: ${code}`)
            if (code === 0) {
                resolve();
            } else {
                reject();
            }
        });
    });
}
var commands = ["npm version", "npm install", "gulp \"run-tests\""];
var rootProj = 'C:\\node\\GitHook\\tmp\\point-of-care\\joel-ci\\Source\\Cerner.PointOfCare.UI';

github.on('*', function(event, repo, ref, data) {

    if (event === "ping") return "pong";
    if (event == "pull_request") return "boom";
    if (ref.indexOf('joel-ci') == -1) return "boomer";

    var splitBranch = ref.split("/"),
        branchName = splitBranch[splitBranch.length - 1],
        sha1 = data.after,
        cloneOptions = new nodegit.CloneOptions(),
        branchPathFull = path.join(config.rootDir, repo, branchName);

    cloneOptions.checkoutBranch = branchName;

    console.log('Cleaning');
    fse.remove(branchPathFull, function(err) {
        if (err) return console.error(err)
        console.log('Creating');
        fse.ensureDir(branchPathFull, function(err2) {
            if (err) return console.error(err2);
            console.log('Cloning');
            nodegit.Clone(data.repository.html_url, branchPathFull, cloneOptions)
                .then(function(repo) {
                    console.log('Updating status');
                    console.log(repo)
                    var comConfig = require('./joel-ci.json');

                    var baseUrl = url.parse(data.repository.statuses_url.replace("{sha}", data.after), false, true);
                    baseUrl.auth = `${comConfig.authUser}:${comConfig.authToken}`;
                    var postUrl = `${baseUrl.protocol}//${baseUrl.auth}@${baseUrl.hostname}${baseUrl.path}`;
                    //'https://js022742:fb924bf64d160620454f462990ae2d5f0436e97a@github.cerner.com/api/v3/repos/js022742/TestHookRepo/statuses/' + sha1

                    request.post(postUrl, {
                        'json': true,
                        'body': payloadGenerator("pending", "Running tests")
                    }, function(error, response, body) {
                        var commands = ["npm version", "echo BOOOOOOOOOOM"];
                        var rootProj = 'C:\\node\\GitHook\\tmp\\point-of-care\\joel-ci\\Source\\Cerner.PointOfCare.UI';
                        var goodToGo = true;

                        Promise.reduce(commands, function(ind, curCommand) {
                                return runTask(curCommand, rootProj, process.env);
                            }, 0).then(() => {
                                console.log('ALL TESTS RAN SUCCESSFULLY!');
                            })
                            .catch(() => {
                                console.log('SOME TESTS OR SOMETHING IN THE SAUCE STACK HAS FAILED!');
                                goodToGo = false;
                            });

                        if (goodToGo == false) {
                            //When tests fail
                            payload = payloadGenerator("failure", "error executing task(s)");
                        } else {
                            payload = payloadGenerator("success", "Ready to be merged");
                        }

                        request.post(postUrl, {
                            'json': true,
                            'body': payload
                        }, function(error, response, body) {
                            console.log('Done for ' + sha1);
                        });
                    });
                }, function(failure) {
                    console.log(failure);
                })
                .done(function() {
                    console.log('Processing ' + sha1);
                });
        });
    })
});

github.listen();