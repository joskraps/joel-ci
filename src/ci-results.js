const http = require('http');
const Router = require('node-router');
const fs = require('fs');
const path = require('path');

module.exports = {
  setupResultsServer(rootPath) {
    const router = Router();
    const route = router.push;

    function resultsHandler(req, resp, next) {
      const repo = req.query.repo;
      const branch = req.query.branch;
      const commit = req.query.commit;
      const resultPath = path.join(rootPath, repo, branch, `${commit}.log`);

      resp.writeHead(200, { 'Content-Type': 'text/javascript' });
      const fileStream = fs.createReadStream(resultPath);

      fileStream.pipe(resp);

      next();
    }

    route('/results/', resultsHandler);

    http.createServer(router).listen(667);
  },
};

