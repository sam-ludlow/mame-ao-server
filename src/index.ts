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
                title: 'Non-optical disc based systems',
                href: '/tosec/tosec',
            },
            {
                text: 'TOSEC-ISO',
                title: 'Optical disc based systems',
                href: '/tosec/tosec-iso',
            },
            {
                text: 'TOSEC-PIX',
                title: 'Scans of software and hardware manuals, magazine scans, computing catalogs, and videos',
                href: '/tosec/tosec-pix',
            },
        ],
    },
];

export class RequestInfo {

    public Url: string;
    public Query: string;
    public Paramters: any;
    public UrlParts: string[];
    public UrlPaths: string[];

    constructor(req: http.IncomingMessage) {

        [this.Url, this.Query] = (req.url || '/').split('?');

        this.Paramters = { search: '', offset: 0, limit: 1000 };

        if (this.Query !== undefined) {
            this.Query.split('&').forEach(queryPart => {
                const pair = queryPart.split('=');
                if (pair.length === 2) {
                    switch (pair[0]) {
                        case 'search':
                            this.Paramters.search = decodeURIComponent(pair[1]);
                            break;

                        case 'offset':
                            this.Paramters.offset = parseInt(pair[1], 10);
                            if (Number.isNaN(this.Paramters.offset) == true || this.Paramters.offset < 0)
                                this.Paramters.offset = 0;
                            break;
                    }
                }
            });
        }

        this.UrlParts = this.Url.split('/').filter(url => url !== '');

        this.UrlPaths = ['/'];
        this.UrlParts.forEach((part, index) => {
            this.UrlPaths.push(`${index > 0 ? this.UrlPaths[index] : ''}/${part}`);
        });
    }
}

export class ResponeInfo {

    public Title: string = '';
    public Heading: string = '';
    public NavMenu: string = '';
    public Info: string = '';
    public Body: string = '';
    public Extention: string = '';
}

const requestListener: http.RequestListener = async (
    req: http.IncomingMessage,
    res: http.ServerResponse) =>
{
    const requestInfo = new RequestInfo(req);
    const responseInfo = new ResponeInfo();

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

    //
    // Menu
    //
    const walkMenu = (current: any) => {
        responseInfo.NavMenu += '<table class="nav"><tr>';
        
        let foundMenu: any;

        current.forEach((menuItem: any) => {

            if (requestInfo.UrlPaths.includes(menuItem.href))
                foundMenu = menuItem;

            const navClass = requestInfo.UrlPaths.includes(menuItem.href) ? 'nav-on' : 'nav-off';

            responseInfo.NavMenu += `<td class="${navClass}"><a class="${navClass}" href="${menuItem.href}" title="${menuItem.title}">${menuItem.text}</a></td>`;
        });
        responseInfo.NavMenu += '</tr></table>';

        if (foundMenu !== undefined && foundMenu.menu !== undefined)
            walkMenu(foundMenu.menu);
    };

    walkMenu(rootMenu);

    //
    // Routing
    //
    const validExtentions = [ '', 'xml', 'json', 'html' ];

    const extentionContentTypes: { [key: string]: any } = {
        '': 'text/html; charset=utf-8',
        'html': 'text/html; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'xml': 'text/xml; charset=utf-8',
    };

    concurrentRequests++;

    try {

        if (requestInfo.UrlParts.length === 0) {

            responseInfo.Title = 'Spludlow Data Web';
            responseInfo.Heading = responseInfo.Title;
            responseInfo.Body = assets['root.html'];

        } else {

            const application = applicationServers[requestInfo.UrlParts[0]];

            if (application === undefined)
                throw new Error(`Application not found: ${requestInfo.UrlParts[0]}`);

            responseInfo.Info = application.Info;

            switch (requestInfo.UrlParts.length) {
                
                case 1:
                    responseInfo.Title = `${application.Key.toUpperCase()} (${application.Version})`;
                    responseInfo.Heading = responseInfo.Title;
                    responseInfo.Body = assets[`${application.Key}.html`];
                    break;

                case 2:
                    switch (requestInfo.UrlParts[0]) {
                        case 'mame':
                        case 'hbmame':
                            switch (requestInfo.UrlParts[1]) {
                                case 'machine':
                                    const pageData = await mame.getMachines(requestInfo.Paramters.search, requestInfo.Paramters.offset, requestInfo.Paramters.limit, application.Key);

                                    let viewCount = pageData.length;
                                    let totalCount = viewCount === 0 ? 0 : pageData[0].filter((r: any) => r.metadata.colName === 'ao_total')[0].value;

                                    let nav = '';
                                    let prevOffset = requestInfo.Paramters.offset - requestInfo.Paramters.limit;
                                    if (prevOffset >= 0)
                                        nav += `<a href="${requestInfo.Url}?search=${requestInfo.Paramters.search}&offset=${prevOffset}">PREV</a> &bull; `;
                                    else
                                        nav += 'PREV &bull; ';


                                    let nextOffset = requestInfo.Paramters.offset + requestInfo.Paramters.limit;
                                    if (nextOffset < totalCount)
                                        nav += `<a href="${requestInfo.Url}?search=${requestInfo.Paramters.search}&offset=${nextOffset}">NEXT</a> &bull; `;
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

                                    let machineHtml: string = assets['mame-machine.html'].replace('@DATA@', tools.htmlTable(pageData, columnDefs, application.Key));
                                    machineHtml = machineHtml.replace('@TOP@', nav);
                                    machineHtml = machineHtml.replace('@BOTTOM@', nav);

                                    responseInfo.Title = `${application.Key.toUpperCase()} (${application.Version}) machine`;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = machineHtml;
                                    break;

                                case 'software':
                                    const data = await mame.getSoftwareLists(application.Key);

                                    responseInfo.Title = data[0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = data[1].value;
                                    break;
                            }
                            break;

                        case 'fbneo':
                            let datafile_key = requestInfo.UrlParts[1];

                            if (datafile_key.includes('.') === true)
                                [ datafile_key, responseInfo.Extention ] = datafile_key.split('.');

                            if (validExtentions.includes(responseInfo.Extention) === false)
                                throw new Error('Bad extention');

                            if (validNameRegEx.test(datafile_key) !== true)
                                throw new Error(`bad datafile_key`);

                            if (fbneoDatafileKeys.includes(datafile_key) === false)
                                throw new Error(`unkown datafile_key`);

                            const fbneo_data = await mame.getFBNeoDataFile(datafile_key, responseInfo.Extention);

                            responseInfo.Title = fbneo_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = fbneo_data[1].value;
                            break;

                        case 'tosec':
                            const tosec_category = requestInfo.UrlParts[1];
                            if (['tosec', 'tosec-iso', 'tosec-pix'].includes(tosec_category) === false)
                                throw new Error('Bad TOSEC category');

                            const tosec_data = await mame.getTosecDataFiles(tosec_category);

                            responseInfo.Title = tosec_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = tosec_data[1].value;
                            break;

                    }
                    break;

                case 3:
                    switch (requestInfo.UrlParts[0]) {
                        case 'mame':
                        case 'hbmame':
                            switch (requestInfo.UrlParts[1]) {
                                case 'machine':
                                    let machine_name = requestInfo.UrlParts[2];

                                    if (machine_name.includes('.') === true)
                                        [ machine_name, responseInfo.Extention ] = machine_name.split('.');

                                    if (validExtentions.includes(responseInfo.Extention) === false)
                                        throw new Error('Bad extention');

                                    if (validNameRegEx.test(machine_name) !== true)
                                        throw new Error(`bad machine name`);
                            
                                    const data = await mame.getMachine(machine_name, responseInfo.Extention, application.Key);

                                    responseInfo.Title = data[0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = data[1].value;
                                    break;

                                case 'software':
                                    let softwarelist_name = requestInfo.UrlParts[2];

                                    if (softwarelist_name.includes('.') === true)
                                        [ softwarelist_name, responseInfo.Extention ] = softwarelist_name.split('.');

                                    if (validExtentions.includes(responseInfo.Extention) === false)
                                        throw new Error('Bad extention');
                                    
                                    if (validNameRegEx.test(softwarelist_name) !== true)
                                        throw new Error(`bad softwarelist_name`);

                                    const software_data = await mame.getSoftwareList(softwarelist_name, responseInfo.Extention, application.Key);

                                    responseInfo.Title = software_data[0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = software_data[1].value;
                                    break;
                            }
                            break;

                        case 'fbneo':
                            const datafile_key = requestInfo.UrlParts[1];
                            let game_name = requestInfo.UrlParts[2];

                            if (game_name.includes('.') === true)
                                [ game_name, responseInfo.Extention ] = game_name.split('.');

                            if (validExtentions.includes(responseInfo.Extention) === false)
                                throw new Error('Bad extention');

                            if (validNameRegEx.test(datafile_key) !== true)
                                throw new Error(`bad datafile_key`);

                            if (fbneoDatafileKeys.includes(datafile_key) === false)
                                throw new Error(`unkown datafile_key`);
                            
                            if (validNameRegEx.test(game_name) !== true)
                                throw new Error(`bad game_name`);

                            const fbneo_data = await mame.getFBNeoGame(datafile_key, game_name, responseInfo.Extention);

                            responseInfo.Title = fbneo_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = fbneo_data[1].value;
                            break;

                        case 'tosec':
                            const tosec_category = requestInfo.UrlParts[1];
                            if (['tosec', 'tosec-iso', 'tosec-pix'].includes(tosec_category) === false)
                                throw new Error('Bad TOSEC category');

                            let name = decodeURIComponent(requestInfo.UrlParts[2]);

                            validExtentions.forEach(validExtention => {
                                if (validExtention != '' && name.endsWith('.' + validExtention) == true) {
                                    responseInfo.Extention = validExtention;
                                    name = name.slice(0, -(responseInfo.Extention.length + 1));
                                }
                            });

                            const tosec_data = await mame.getTosecDataFile(tosec_category, name, responseInfo.Extention);

                            responseInfo.Title = tosec_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = tosec_data[1].value;
                            break;
                    }
                    break;

                case 4:
                    switch (requestInfo.UrlParts[0]) {
                        case 'mame':
                        case 'hbmame':
                            const softwarelist_name = requestInfo.UrlParts[2];
                            if (validNameRegEx.test(softwarelist_name) !== true)
                                throw new Error(`bad softwarelist_name`);

                            let software_name = requestInfo.UrlParts[3];

                            if (software_name.includes('.') === true)
                                [ software_name, responseInfo.Extention ] = software_name.split('.');

                            if (validExtentions.includes(responseInfo.Extention) === false)
                                throw new Error('Bad extention');

                            if (validNameRegEx.test(software_name) !== true)
                                throw new Error(`bad software_name`);

                            const data = await mame.getSoftware(softwarelist_name, software_name, responseInfo.Extention, application.Key);

                            responseInfo.Title = data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = data[1].value;
                            break;

                        case 'tosec':
                            const tosec_category = requestInfo.UrlParts[1];
                            if (['tosec', 'tosec-iso', 'tosec-pix'].includes(tosec_category) === false)
                                throw new Error('Bad TOSEC category');
                            const datafile_name = decodeURIComponent(requestInfo.UrlParts[2]);
                            let game_name = decodeURIComponent(requestInfo.UrlParts[3]);

                            validExtentions.forEach(validExtention => {
                                if (validExtention != '' && game_name.endsWith('.' + validExtention) == true) {
                                    responseInfo.Extention = validExtention;
                                    game_name = game_name.slice(0, -(responseInfo.Extention.length + 1));
                                }
                            });

                            const tosecData = await mame.getTosecGame(tosec_category, datafile_name, game_name, responseInfo.Extention);

                            responseInfo.Title = tosecData[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = tosecData[1].value;
                            break;
                    }
                    break;
            }

        }

        if (responseInfo.Body === '')
            throw new Error('Route');

        res.writeHead(200, { 'Content-Type': extentionContentTypes[responseInfo.Extention] });

        if (responseInfo.Extention === '') {

            let html = assets['master.html'];

            html = html.replace('@HEAD@', `<title>${responseInfo.Title}</title>`);

            html = html.replace('@NAV@', responseInfo.NavMenu);
            html = html.replace('@INFO@', responseInfo.Info);

            html = html.replace('@H1@', responseInfo.Heading);
            html = html.replace('@BODY@', responseInfo.Body);

            res.write(html);
        } else {
            res.write(responseInfo.Body);
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
