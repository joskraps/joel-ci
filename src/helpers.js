var request = require('request')
    , url = require('url')
    , exec = require("child_process").exec
    , path = require('path')
    , nodegit = require("nodegit");

module.exports = {
    runTask: function (command, root) {
        //var mergedEnv = Object.assign({ BROWSER: browser, TUNNEL: tunnel }, process.env);
        console.log(`Path: ${root} Command: ${command}`);

        var promiseFromChildProcess = function (child) {
            return new Promise((resolve, reject) => {
                child.addListener('error', (code) => {
                    console.log('ChildProcess error', code);
                    reject();
                });
                child.addListener('exit', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject();
                    }
                });
            })
        };

        var com = exec(command + " --ansi", { cwd: root, env: process.env, stdio: "inherit" });
        
        com.stdout.on('data', function (data) { 
            console.log(data);
        });

        com.stderr.on('data', function (data) { 
            console.log(data);
        });

        com.on('exit', function (data) { 
            console.log(data);
        });

        return promiseFromChildProcess(com);
    },
    updateStatus: function (statusUrl, status, message, callback) {
        request.post(statusUrl, {
            'json': true,
            'body': {
                "state": status,
                "description": message,
                "context": "continuous-integration/joel-ci"
            }
        }, function (error, response, body) {
            if (callback) callback(error, response, body);

            return false;
        })
    },
    formatStatusUrl: function (baseUrl, sha, config) {
        var baseUrl = url.parse(baseUrl.replace("{sha}", sha), false, true);
        baseUrl.auth = `${config.authUser}:${config.authToken}`;
        var postUrl = `${baseUrl.protocol}//${baseUrl.auth}@${baseUrl.hostname}${baseUrl.path}`;

        return postUrl;
    },
    parseRequestConfig: function(ref,repo,data,config){
        var options = {};
        var splitRef = ref.split("/");
        
        options.branchName = splitRef[splitRef.length - 1];
        options.sha1 = data.after;
        options.branchFullPath = path.join(config.rootDir,repo,options.branchName,options.sha1);
        options.postUrl = this.formatStatusUrl(data.repository.statuses_url, data.after, config);
        options.cloneOptions = new nodegit.CloneOptions();
        options.cloneOptions.checkoutBranch = options.branchName;

        return options;
    }
}