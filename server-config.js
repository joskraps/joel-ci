var path = require('path');

module.exports = {
    "rootDir": path.join(__dirname, "tmp"),
    "authUser": "js022742",
    "authToken": "fb924bf64d160620454f462990ae2d5f0436e97a",
    "authSecret": "",
    "authClient": "",
    gitHubHookConfig: {
        host: "0.0.0.0",
        port: 666,
        secret: "123456",
        logger: console,
        path: '/gitback'
    },
    "ignoreDirs": ["Temp", "_Temp", "node_modules", "bin", "obj", ".vscode", ".git"],
    "configFileName": "joel-ci.json",
    "resultsPort": 667,
    "resultsProtocol": "http://",
    "ignoredBranches": [],
    "acceptedBranches": ['*']
}
