var path = require('path');

module.exports = {
    rootDir : path.join(__dirname, "tmp"),
    gitHubHookConfig: { 
        host: "0.0.0.0",
        port: 666,
        secret: "123456",
        logger: console,
        path: '/gitback'
    }
}