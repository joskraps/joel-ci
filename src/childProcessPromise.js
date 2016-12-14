module.exports = {
    runTask: function(command, root) {
        //var mergedEnv = Object.assign({ BROWSER: browser, TUNNEL: tunnel }, process.env);
        console.log(`Path: ${root} Command: ${command}`);

        var exec = require("child_process").exec;
        var promiseFromChildProcess = function(child) {
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

        var com = exec(command, { cwd: root, env: process.env });
        com.stdout.on('data', function(data) { console.log(data) });
        com.stderr.on('data', function(data) { console.log(data) });
        com.on('exit', function(data) { console.log(data) });

        return promiseFromChildProcess(com);
    }
}