import http from 'http';

import * as mame from './mame';
import * as tools from './tools';

var validNameRegEx = /^[a-zA-Z0-9-_]+$/;

const assets: any = {};

const loadAssets = async () => {

    const directory = './assets';

    const filenames: string[] = await tools.directoryFiles(directory);

     await Promise.all(filenames.map(async filename => {

        if (filename.endsWith('.ico') === true)
            assets[filename] = await tools.fileReadBuffer(`${directory}/${filename}`);
        else
            assets[filename] = await tools.fileRead(`${directory}/${filename}`);
    }));
}

let concurrentRequests = 0;

const requestListener: http.RequestListener = async (
    req: http.IncomingMessage,
    res: http.ServerResponse) =>
{
    const now: Date = new Date();

    console.log(`${now.toUTCString()}\t${req.url}\t${req.method}\t${concurrentRequests}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Server', 'Spludlow Data Web/0.0');

    if (concurrentRequests > 1024) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8'});
        res.write('<h1>Server Busy - Try Later</h1>');
        res.end();
        return;
    }

    if (req.method === 'OPTIONS') {
        res.setHeader("Allow", "OPTIONS, GET");
        res.end();
        return;
    }


    switch (req.url) {

        case '/favicon.ico':
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['favicon.ico']);
            res.end();
            return;

        case '/stylesheet.css':
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['stylesheet.css']);
            res.end();
            return;

        case '/spludlow.svg':
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['spludlow.svg']);
            res.end();
            return;

        case '/.well-known/appspecific/com.chrome.devtools.json':
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write('{}');
            res.end();
            return;

        default:
            break;
    }


    const [url, query] = (req.url || '/').split('?');

    let urlParts = url.split('/').filter(u => u !== '');
    //console.log(`${req.url}\t${urlParts.length}\t${urlParts}`);

    const validExtentions = [ '', 'xml', 'json', 'html' ];

    const extentionContentTypes: { [key: string]: any } = {
        '': 'text/html; charset=utf-8',
        'html': 'text/html; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'xml': 'text/xml; charset=utf-8',
    };

    concurrentRequests++;

    try {

        let extention = '';
        let data: any[] | undefined;


        if (urlParts.length === 0)
            data = [ {value: 'Spludlow Data Web'}, {value: assets['root.html'] } ];
        
        if (urlParts.length === 1 && urlParts[0] === 'mame')
            data = [ {value: 'Spludlow Data Web'}, {value: assets['mame.html'] } ];

        if (urlParts.length === 2 && urlParts[0] === 'mame' && urlParts[1] === 'machine')
            data = [ {value: 'Spludlow Data Web'}, {value: assets['mame-machine.html'] } ];

        // MAME Machine
        if (urlParts.length === 3 && urlParts[0] === 'mame' && urlParts[1] === 'machine') {
    
            let machine_name = urlParts[2];

            if (machine_name.includes('.') === true)
                [ machine_name, extention ] = machine_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');

            if (validNameRegEx.test(machine_name) !== true)
                throw new Error(`bad machine name`);
    
            data = await mame.getMachine(machine_name, extention);
        }

        //  MAME Software Lists
        if (urlParts.length === 2 && urlParts[0] === 'mame' && urlParts[1] === 'software') {

            data = await mame.getSoftwareLists();
        }

        // MAME Software List
        if (urlParts.length === 3 && urlParts[0] === 'mame' && urlParts[1] === 'software') {
        
            let softwarelist_name = urlParts[2];

            if (softwarelist_name.includes('.') === true)
                [ softwarelist_name, extention ] = softwarelist_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');
            
            if (validNameRegEx.test(softwarelist_name) !== true)
                throw new Error(`bad softwarelist_name`);

            data = await mame.getSoftwareList(softwarelist_name, extention);
        }

        // MAME Software
        if (urlParts.length === 4 && urlParts[0] === 'mame' && urlParts[1] === 'software') {
        
            const softwarelist_name = urlParts[2];
            if (validNameRegEx.test(softwarelist_name) !== true)
                throw new Error(`bad softwarelist_name`);

            let software_name = urlParts[3];

            if (software_name.includes('.') === true)
                [ software_name, extention ] = software_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');

            if (validNameRegEx.test(software_name) !== true)
                throw new Error(`bad software_name`);

            data = await mame.getSoftware(softwarelist_name, software_name, extention);
        }

        if (data === undefined) {
            throw new Error('Route not found');
        }

        res.writeHead(200, { 'Content-Type': extentionContentTypes[extention] });

        if (extention === '') {

            let html = assets['master.html'];

            html = html.replace('@HEAD@', '');

            html = html.replace('@NAV@', '');
            html = html.replace('@INFO@', '');

            html = html.replace('@H1@', data[0].value);
            html = html.replace('@BODY@', data[1].value);

            res.write(html);
        } else {
            res.write(data[1].value);
        }
    }
    catch (error) {

        console.log(error);

        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8'});

        res.write('error');

    }
    finally {
        concurrentRequests--;
        res.end();
    }

}

const run = async () => {

    await loadAssets();

    const server: http.Server = http.createServer(requestListener);
    server.listen(32103);
}

run();
