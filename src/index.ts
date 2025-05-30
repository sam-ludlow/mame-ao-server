import http from 'http';

let server: http.Server;

const requestListener: http.RequestListener = async (
    req: http.IncomingMessage,
    res: http.ServerResponse) =>
{
    console.log('top request: ' + req.url);


    res.writeHead(200, { 'Content-Type': 'text/plain'});
    res.write('hello: ' + req.url + ' # ' + (new Date()).toISOString());
    res.end();
    
}

server = http.createServer(requestListener);
server.listen(8888);

