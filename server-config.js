const path = require('path');

module.exports = {
  rootDir: path.join(__dirname, 'tmp'),
  authUser: 'auth_user',
  authToken: 'auth_token',
  authSecret: '',
  authClient: '',
  gitHubHookConfig: {
    host: '0.0.0.0',
    port: 666,
    secret: '123456',
    logger: console,
    path: '/gitback',
  },
  ignoreDirs: ['Temp', '_Temp', 'node_modules', 'bin', 'obj', '.vscode', '.git'],
  configFileName: 'joel-ci.json',
  resultsPort: 667,
  resultsProtocol: 'http://',
  ignoredBranches: [],
  acceptedBranches: ['*'],
};
