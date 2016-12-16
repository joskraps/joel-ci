var request = require('request')
    , url = require('url')
    , exec = require("child_process").exec;

module.exports = {
    runTask: function (command, root) {
        //var mergedEnv = Object.assign({ BROWSER: browser, TUNNEL: tunnel }, process.env);
        console.log(`Path: ${root} Command: ${command}`);


        var promiseFromChildProcess = function (child) {
            return new Promise((resolve, reject) => {
                child.addListener('error', (code, signal) => {
                    console.log('ChildProcess error', code, signal);
                    reject();
                });
                child.addListener('exit', (code, signal) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject();
                    }
                });
            })
        };

        var com = exec(command, { cwd: root, env: process.env, stdio: "inherit" });
        com.stdout.on('data', function (data) { console.log(data) });
        com.stderr.on('data', function (data) { console.log(data) });
        com.on('exit', function (data) { console.log(data) });

        return promiseFromChildProcess(com);
    },
    updateStatus: function (statusUrl, status, message, callback) {
        var self = this;
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
    }
}