import http from 'http';

import * as mame from './mame';
import * as tools from './tools';

import Tedious from 'tedious';

var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

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



export interface ApplicationServer {
    Key: string;
    Title: string;
    Info: string;
    Version: string;
    SubSets: any;
}

export interface ApplicationServerConstructable {
    new(key: string, subKeys: string[]): ApplicationServer;
}

export class MameApplicationServer implements ApplicationServer {
    
    public Key: string;
    public Title: string;
    public Info: string;
    public Version: string;

    public SubSets: any = {};

    constructor(key: string, subKeys: string[]) {

        this.Key = key;

        this.Title = '';
        this.Info = '';
        this.Version = '';

        subKeys.forEach((subKey) => {

            let databaseName = `ao-${key}`;

            if (key.endsWith('mame') === true)
                databaseName += `-${subKey}`;

            this.SubSets[subKey] = {
                Key: subKey,
                Title: '',
                Info: '',
                SqlConfig: tools.sqlConfig('SPLCAL-MAIN', databaseName),
            };

        });
    }

    public initialize = async (): Promise<any> => {

        await Promise.all(Object.keys(this.SubSets).map(async (subKey) => {

            const subSet = this.SubSets[subKey];

            const connection: Tedious.Connection = new Connection(subSet.SqlConfig);

            await tools.sqlOpen(connection);
        
            let data: any[] = [];
            try {
        
                const request: Tedious.Request = new Request('SELECT * FROM [_metadata]');
        
                const response = await tools.sqlRequest(connection, request);
        
                if (response.length === 0)
                    throw new Error('_metadata not found');

                console.log(response[0].filter((item: any) => item.metadata.colName === 'info'));


                this.Info = response[0].filter((item: any) => item.metadata.colName === 'info')[0].value;
                this.Version = response[0].filter((item: any) => item.metadata.colName === 'version')[0].value;
            }
            finally {
                await tools.sqlClose(connection);
            }

        }));
    }


}

const applicationServers: any = {};

const fbneoDatafileKeys = ['arcade', 'channelf', 'coleco', 'fds', 'gamegear', 'megadrive', 'msx', 'neogeo', 'nes', 'ngp', 'pce', 'sg1000', 'sgx', 'sms', 'snes', 'spectrum', 'tg16', ];

const rootMenu: any[] =
[
    {
        text: 'MAME',
        title: 'MAME Data',
        href: '/mame',
        menu: [
            {
                text: 'MAME Machine',
                title: 'MAME Machine Data',
                href: '/mame/machine',
            },
            {
                text: 'MAME Software',
                title: 'MAME Software Data',
                href: '/mame/software',
            },
        ],
    },
    {
        text: 'HBMAME',
        title: 'HBMAME Data',
        href: '/hbmame',
        menu: [
            {
                text: 'HBMAME Machine',
                title: 'HBMAME Machine Data',
                href: '/hbmame/machine',
            },
            {
                text: 'HBMAME Software',
                title: 'HBMAME Software Data',
                href: '/hbmame/software',
            },
        ],
    },
    {
        text: 'FBNeo',
        title: 'FBNeo Data',
        href: '/fbneo',
        menu: [
            { text: 'arcade', title: 'Arcade Games', href: '/fbneo/arcade'},
            { text: 'channelf', title: 'Fairchild Channel F Games', href: '/fbneo/channelf'},
            { text: 'coleco', title: 'ColecoVision Games', href: '/fbneo/coleco'},
            { text: 'fds', title: 'FDS (Famicom Disk System) Games', href: '/fbneo/fds'},
            { text: 'gamegear', title: 'Game Gear Games', href: '/fbneo/gamegear'},
            { text: 'megadrive', title: 'Megadrive Games', href: '/fbneo/megadrive'},
            { text: 'msx', title: 'MSX 1 Games', href: '/fbneo/msx'},
            { text: 'neogeo', title: 'Neo Geo Games', href: '/fbneo/neogeo'},
            { text: 'nes', title: 'NES Games', href: '/fbneo/nes'},
            { text: 'ngp', title: 'Neo Geo Pocket Games', href: '/fbneo/ngp'},
            { text: 'pce', title: 'PC-Engine Games', href: '/fbneo/pce'},
            { text: 'sg1000', title: 'Sega SG-1000 Games', href: '/fbneo/sg1000'},
            { text: 'sgx', title: 'SuprGrafx Games', href: '/fbneo/sgx'},
            { text: 'sms', title: 'Master System Games', href: '/fbneo/sms'},
            { text: 'snes', title: 'SNES Games', href: '/fbneo/snes'},
            { text: 'spectrum', title: 'ZX Spectrum Games', href: '/fbneo/spectrum'},
            { text: 'tg16', title: 'TurboGrafx 16 Games', href: '/fbneo/tg16'},
        ],
    },
    {
        text: 'TOSEC',
        title: 'TOSEC Data',
        href: '/tosec',
        menu: [
            {
                text: 'TOSEC',
                title: 'HBMAME Machine Data',
                href: '/tosec/tosec',
            },
            {
                text: 'TOSEC-ISO',
                title: 'HBMAME Software Data',
                href: '/tosec/tosec-iso',
            },
            {
                text: 'TOSEC-PIX',
                title: 'HBMAME Software Data',
                href: '/tosec/tosec-pix',
            },
        ],
    },
];

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

    const paramters = { search: '', offset: 0, limit: 1000 };

    if (query !== undefined) {
        query.split('&').forEach(queryPart => {
            const pair = queryPart.split('=');
            if (pair.length === 2) {
                switch (pair[0]) {
                    case 'search':
                        paramters.search = decodeURIComponent(pair[1]);
                        break;

                    case 'offset':
                        paramters.offset = parseInt(pair[1], 10);
                        if (Number.isNaN(paramters.offset) == true || paramters.offset < 0)
                            paramters.offset = 0;
                        break;
                }
            }
        });
    }
    
    let urlParts = url.split('/').filter(u => u !== '');

    const urlPaths = ['/'];
    urlParts.forEach((item, index) => {
        urlPaths.push(`${index > 0 ? urlPaths[index] : ''}/${item}`);
    });

/*     console.log(`URL: ${req.url}`);
    console.log(`PARTS: ${urlParts.length}\t${urlParts}`);
    console.log(`PATHS: ${urlPaths.length}\t${urlPaths}`); */

    //
    // Menu
    //
    const walkMenu = (current: any) => {
        navMenu += '<table class="nav"><tr>';
        
        let foundMenu: any;

        current.forEach((menuItem: any) => {

            if (urlPaths.includes(menuItem.href))
                foundMenu = menuItem;

            const navClass = urlPaths.includes(menuItem.href) ? 'nav-on' : 'nav-off';

            navMenu += `<td class="${navClass}"><a class="${navClass}" href="${menuItem.href}" title="${menuItem.title}">${menuItem.text}</a></td>`;
        });
        navMenu += '</tr></table>';

        if (foundMenu !== undefined && foundMenu.menu !== undefined)
            walkMenu(foundMenu.menu);
    };

    let navMenu = '';

    walkMenu(rootMenu);

    //
    // Info
    //

    let applicationServer: any;
    
    let title = '';
    let info = '';

    if (urlParts.length > 0) {

        applicationServer = applicationServers[urlParts[0]];

        //console.log(applicationServer);

        if (applicationServer !== undefined)
            info = applicationServer.Info;

    }

    //applicationServers[];

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
            data = [ {value: `MAME (${applicationServer.Version})`}, {value: assets['mame.html'] } ];

        if (urlParts.length === 1 && urlParts[0] === 'hbmame')
            data = [ {value: `HBMAME (${applicationServer.Version})`}, {value: assets['hbmame.html'] } ];

        if (urlParts.length === 1 && urlParts[0] === 'fbneo')
            data = [ {value: `FBNeo (${applicationServer.Version})`}, {value: assets['fbneo.html'] } ];

        if (urlParts.length === 1 && urlParts[0] === 'tosec')
            data = [ {value: `TOSEC (${applicationServer.Version})`}, {value: assets['tosec.html'] } ];

        // Mame Machines
        if (urlParts.length === 2 && (urlParts[0] === 'mame' || urlParts[0] === 'hbmame') && urlParts[1] === 'machine') {

            let lastTime = Date.now();

            const pageData = await mame.getMachines(paramters.search, paramters.offset, paramters.limit, urlParts[0]);

            //console.log(`1: ${Date.now() - lastTime}`);
            lastTime = Date.now();

            let viewCount = pageData.length;
            let totalCount = viewCount === 0 ? 0 : pageData[0].filter((r: any) => r.metadata.colName === 'ao_total')[0].value;


            let nav = '';
            let prevOffset = paramters.offset - paramters.limit;
            if (prevOffset >= 0)
                nav += `<a href="${url}?search=${paramters.search}&offset=${prevOffset}">PREV</a> &bull; `;
            else
                nav += 'PREV &bull; ';


            let nextOffset = paramters.offset + paramters.limit;
            if (nextOffset < totalCount)
                nav += `<a href="${url}?search=${paramters.search}&offset=${nextOffset}">NEXT</a> &bull; `;
            else
                nav += 'NEXT &bull; ';

            nav += `view:${viewCount} total:${totalCount}`;

            const columnDefs = {
                'name': 'Name',
                'description': 'Description',
                'year': 'Year',
                'manufacturer': 'Manufacturer',
                'romof': 'Rom of',
                'cloneof': 'Clone of',
            };

            let machineHtml: string = assets['mame-machine.html'].replace('@DATA@', tools.htmlTable(pageData, columnDefs, urlParts[0]));
            machineHtml = machineHtml.replace('@TOP@', nav);
            machineHtml = machineHtml.replace('@BOTTOM@', nav);

            //console.log(`2: ${Date.now() - lastTime}`);
            lastTime = Date.now();

            data = [ {value: `${applicationServer.Key} (${applicationServer.Version}) machines`}, {value: machineHtml } ];

            //console.log(`3: ${Date.now() - lastTime}`);
            lastTime = Date.now();
        }


        // MAME Machine
        if (urlParts.length === 3 && (urlParts[0] === 'mame' || urlParts[0] === 'hbmame') && urlParts[1] === 'machine') {
    
            let machine_name = urlParts[2];

            if (machine_name.includes('.') === true)
                [ machine_name, extention ] = machine_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');

            if (validNameRegEx.test(machine_name) !== true)
                throw new Error(`bad machine name`);
    
            data = await mame.getMachine(machine_name, extention, urlParts[0]);
        }

        //  MAME Software Lists
        if (urlParts.length === 2 && (urlParts[0] === 'mame' || urlParts[0] === 'hbmame') && urlParts[1] === 'software') {

            data = await mame.getSoftwareLists(urlParts[0]);
        }

        // MAME Software List
        if (urlParts.length === 3 && (urlParts[0] === 'mame' || urlParts[0] === 'hbmame') && urlParts[1] === 'software') {
        
            let softwarelist_name = urlParts[2];

            if (softwarelist_name.includes('.') === true)
                [ softwarelist_name, extention ] = softwarelist_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');
            
            if (validNameRegEx.test(softwarelist_name) !== true)
                throw new Error(`bad softwarelist_name`);

            data = await mame.getSoftwareList(softwarelist_name, extention, urlParts[0]);
        }

        // MAME Software
        if (urlParts.length === 4 && (urlParts[0] === 'mame' || urlParts[0] === 'hbmame') && urlParts[1] === 'software') {
        
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

            data = await mame.getSoftware(softwarelist_name, software_name, extention, urlParts[0]);
        }

        //
        // FBNeo
        //



        //  FBNeo Datafile
        if (urlParts.length === 2 && urlParts[0] === 'fbneo') {
            let datafile_key = urlParts[1];

            if (datafile_key.includes('.') === true)
                [ datafile_key, extention ] = datafile_key.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');

            if (validNameRegEx.test(datafile_key) !== true)
                throw new Error(`bad datafile_key`);

            if (fbneoDatafileKeys.includes(datafile_key) === false)
                throw new Error(`unkown datafile_key`);

            data = await mame.getFBNeoDataFile(datafile_key, extention);
        }

        //  FBNeo Game
        if (urlParts.length === 3 && urlParts[0] === 'fbneo') {
            const datafile_key = urlParts[1];
            let game_name = urlParts[2];

            if (game_name.includes('.') === true)
                [ game_name, extention ] = game_name.split('.');

            if (validExtentions.includes(extention) === false)
                throw new Error('Bad extention');

            if (validNameRegEx.test(datafile_key) !== true)
                throw new Error(`bad datafile_key`);

            if (fbneoDatafileKeys.includes(datafile_key) === false)
                throw new Error(`unkown datafile_key`);
            
            if (validNameRegEx.test(game_name) !== true)
                throw new Error(`bad game_name`);

            data = await mame.getFBNeoGame(datafile_key, game_name, extention);
        }

        const tosecCategories = ['tosec', 'tosec-iso', 'tosec-pix'];

        // TOSEC Datafiles
        if (urlParts.length === 2 && urlParts[0] === 'tosec' && tosecCategories.includes(urlParts[1]) === true) {
            
            data = await mame.getTosecDataFiles(urlParts[1]);
        }

        // TOSEC DataFile (list of games)
        if (urlParts.length === 3 && urlParts[0] === 'tosec' && tosecCategories.includes(urlParts[1]) === true) {
            let name = decodeURIComponent(urlParts[2]);

            validExtentions.forEach(validExtention => {
                if (validExtention != '' && name.endsWith('.' + validExtention) == true) {
                    extention = validExtention;
                    name = name.slice(0, -(extention.length + 1));
                }
            });

            data = await mame.getTosecDataFile(urlParts[1], name, extention);
        }

        // TOSEC Game (rom details)
        if (urlParts.length === 4 && urlParts[0] === 'tosec' && tosecCategories.includes(urlParts[1]) === true) {
            const datafile_name = decodeURIComponent(urlParts[2]);
            let game_name = decodeURIComponent(urlParts[3]);

            validExtentions.forEach(validExtention => {
                if (validExtention != '' && game_name.endsWith('.' + validExtention) == true) {
                    extention = validExtention;
                    game_name = game_name.slice(0, -(extention.length + 1));
                }
            });

            data = await mame.getTosecGame(urlParts[1], datafile_name, game_name, extention);
        }

        if (data === undefined) {
            throw new Error('Route not found');
        }

        res.writeHead(200, { 'Content-Type': extentionContentTypes[extention] });

        if (extention === '') {

            let html = assets['master.html'];

            html = html.replace('@HEAD@', `<title>${data[0].value}</title>`);

            html = html.replace('@NAV@', navMenu);
            html = html.replace('@INFO@', info);

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

    process.stdin.on('data', (chunk: Buffer) => {
		const command: string = chunk.toString().trim();
		console.log(`COMMAND: ${command}`);

		if (command === 'stop')
			process.exit(0);
	});

    applicationServers['mame'] = new MameApplicationServer('mame', ['machine', 'software']);
    applicationServers['hbmame'] = new MameApplicationServer('hbmame', ['machine', 'software']);
    applicationServers['fbneo'] = new MameApplicationServer('fbneo', fbneoDatafileKeys);
    applicationServers['tosec'] = new MameApplicationServer('tosec', ['tosec', 'tosec-iso', 'tosec-pix']);
    
    await Promise.all(Object.keys(applicationServers).map(async (key) => applicationServers[key].initialize()));

    await loadAssets();

    const server: http.Server = http.createServer(requestListener);
    server.listen(32103);
}

run();
