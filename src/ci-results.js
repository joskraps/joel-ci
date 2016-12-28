var http = require('http');
var Router = require('node-router');
var fs = require('fs');
var path = require('path');

module.exports = {
    setupResultsServer: function (rootPath) {
        var router = Router();
        var route = router.push;
        var localPath = rootPath;

        route("/results/", resultsHandler);

        function resultsHandler(req, resp, next) {
            var repo = req.query.repo;
            var branch = req.query.branch;
            var commit = req.query.commit;
            var resultPath = path.join(rootPath,repo,branch,commit + '.log');

           resp.writeHead(200, {'Content-Type':'text/javascript'});
            var fileStream = fs.createReadStream(resultPath);
            //var test = JSON.parse(fs.readFileSync(resultPath).toString());


            fileStream.pipe(resp);
        }

        var server = http.createServer(router).listen(667);
    }
}









