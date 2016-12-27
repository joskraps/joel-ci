var request = require('request')
    , url = require('url')
    , exec = require("child_process").exec
    , spawn = require("child_process").spawn
    , path = require('path')
    , winston = require('winston')
    , fse = require('fs-extra');

module.exports = {
    runTask: function (command, root,logger) {
        var promiseFromChildProcess = function (child) {
            return new Promise((resolve, reject) => {
                child.addListener('error', (code) => {
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

        var com = spawn(command ,[], { cwd: root, env: process.env});

        com.stdout.on('data', function (data) {
            logger.info(data.toString());
        });

        com.stderr.on('data', function (data) {
            logger.error("Error executing task :(",data);
        });

        com.on('exit', function (data) {
            logger.info("Exit",data);
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
    parseRequestConfig: function (ref, repo, data, config) {
        var options = {};
        var splitRef = ref.split("/");

        options.branchName = splitRef[splitRef.length - 1];
        options.repo = repo;
        options.ref = ref;
        options.sha1 = data.after;
        options.branchFullPath = path.join(config.rootDir, repo, options.branchName, options.sha1);
        options.postUrl = this.formatStatusUrl(data.repository.statuses_url, data.after, config);
        options.repoUrl = data.repository.html_url;

        return options;
    },
    setupLogging: function (reqConfig, logFilePath) {
        var logger = new winston.Logger();
        logger.level = process.env.LOG_LEVEL || 'info';
        var logFilePath = path.join(__dirname, "logs", reqConfig.repo);

        fse.ensureDirSync(logFilePath)

        logger.configure({
            transports: [
                new (winston.transports.File)({ filename: path.join(logFilePath, `joel-ci_${reqConfig.sha1}.logs`) })
            ]
        });

        return logger;
    }
}