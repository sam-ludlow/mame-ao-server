import http from 'http';

import * as tools from './tools';

import Tedious from 'tedious';

var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var validNameRegEx = /^[a-zA-Z0-9-_]+$/;

export interface Application {
    Key: string;
    Version: string;
    Title: string;
    Info: string;

    SubKeys: string[];
    DatabaseConfigs: any[];
}

export interface ApplicationServerConstructable {
    new(key: string): Application;
}

export class ApplicationCore implements Application {
    
    public Key: string;
    public Version: string;
    public Title: string;
    public Info: string;

    public SubKeys: string[];
    public DatabaseConfigs: any[];

    constructor(key: string) {

        this.Key = key;
        this.Version = '';
        this.Title = '';
        this.Info = '';

        this.SubKeys = [];
        this.DatabaseConfigs = [];
    }

    public initialize = async (): Promise<any> => {

        const databaseServer = 'my-mssql-server';

        switch (this.Key) {
            case 'mame':
            case 'hbmame':
                this.SubKeys = ['machine', 'software'];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `ao-${this.Key}-machine`), tools.sqlConfig(databaseServer, `ao-${this.Key}-software`)];
                break;

            case 'fbneo':   //  TODO: Load from DB - build menu
                this.SubKeys = ['arcade', 'channelf', 'coleco', 'fds', 'gamegear', 'megadrive', 'msx', 'neogeo', 'nes', 'ngp', 'pce', 'sg1000', 'sgx', 'sms', 'snes', 'spectrum', 'tg16', ];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `ao-${this.Key}`)];
                break;

            case 'tosec':
                this.SubKeys = ['tosec', 'tosec-iso', 'tosec-pix'];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `ao-${this.Key}`)];
                break;

            default:
                throw new Error(`Unknown core key: ${this.Key}`);
        }

        const metadata = await tools.databaseQuery(this.DatabaseConfigs[0], 'SELECT [version], [info] FROM [_metadata]');
        if (metadata.length === 0)
            throw new Error('_metadata not found');

        this.Version = metadata[0][0].value;
        this.Info = metadata[0][1].value;
    }
}

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

const coreKeys = ['mame', 'hbmame', 'fbneo', 'tosec'];

const applicationServers: any = {};
const assets: any = {};
let concurrentRequests = 0;

const run = async () => {

    process.stdin.on('data', (chunk: Buffer) => {
		const command: string = chunk.toString().trim();
		console.log(`COMMAND: ${command}`);

		if (command === 'stop')
			process.exit(0);
	});

    await loadAssets();

    const server: http.Server = http.createServer(requestListener);
    server.listen(32103);

    await Promise.all(coreKeys.map(async (coreKey) => {

        delete applicationServers[coreKey];

        try {

            const application = new ApplicationCore(coreKey);
            await application.initialize();

            applicationServers[coreKey] = application;

        }
        catch (error) {
            console.log(`!!! Error starting Application: ${coreKey}`);
            console.log(error);
        }
    }));
}

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

const requestListener: http.RequestListener = async (req: http.IncomingMessage, res: http.ServerResponse) => {

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
            // Root
            responseInfo.Title = 'Spludlow Data Web';
            responseInfo.Heading = responseInfo.Title;
            responseInfo.Body = assets['root.html'];

        } else {

            const application = applicationServers[requestInfo.UrlParts[0]];

            if (application === undefined) {
                if (coreKeys.includes(requestInfo.UrlParts[0]) === true)
                    throw new Error(`Core not available: ${requestInfo.UrlParts[0]}`);
                else
                    throw new Error(`Core not found: ${requestInfo.UrlParts[0]}`);
            }
                
            if (requestInfo.UrlParts.length > 1) {
                let name = requestInfo.UrlParts[1];
                switch (application.Key) {
                    case 'fbneo':
                        if (name.includes('.') === true)
                            name = name.split('.')[0];
                        break;
                }

                if (application.SubKeys.includes(name) == false)
                    throw new Error(`The core "${application.Key}" does not have a sub set "${name}"`);
            }

            responseInfo.Info = application.Info;

            switch (requestInfo.UrlParts.length) {
                
                case 1:
                    // Core
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
                                    // Machine Search
                                    const pageData = await getMachines(application.DatabaseConfigs[0], requestInfo.Paramters.search, requestInfo.Paramters.offset, requestInfo.Paramters.limit);

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
                                    // Software List
                                    const data = await tools.databaseQuery(application.DatabaseConfigs[1], 'SELECT [title], [html] FROM [softwarelists_payload]');

                                    responseInfo.Title = data[0][0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = data[0][1].value;
                                    break;
                            }
                            break;

                        case 'fbneo':
                            // Datafile
                            let datafile_key = requestInfo.UrlParts[1];

                            if (datafile_key.includes('.') === true)
                                [ datafile_key, responseInfo.Extention ] = datafile_key.split('.');

                            if (validExtentions.includes(responseInfo.Extention) === false)
                                throw new Error('Bad extention');

                            const fbneo_data = await tools.databasePayload(application.DatabaseConfigs[0], 'datafile_payload', { key: datafile_key }, responseInfo.Extention);

                            responseInfo.Title = fbneo_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = fbneo_data[1].value;
                            break;

                        case 'tosec':
                            // Category
                            const tosec_category = requestInfo.UrlParts[1];

                            const tosec_data = await tools.databasePayload(application.DatabaseConfigs[0], 'category_payload', { category: tosec_category }, responseInfo.Extention);

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
                                    // Machine
                                    let machine_name = requestInfo.UrlParts[2];

                                    if (machine_name.includes('.') === true)
                                        [ machine_name, responseInfo.Extention ] = machine_name.split('.');

                                    if (validExtentions.includes(responseInfo.Extention) === false)
                                        throw new Error('Bad extention');

                                    if (validNameRegEx.test(machine_name) !== true)
                                        throw new Error(`bad machine name`);
                            
                                    const data = await tools.databasePayload(application.DatabaseConfigs[0], 'machine_payload', { machine_name }, responseInfo.Extention);

                                    responseInfo.Title = data[0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = data[1].value;
                                    break;

                                case 'software':
                                    // Software List
                                    let softwarelist_name = requestInfo.UrlParts[2];

                                    if (softwarelist_name.includes('.') === true)
                                        [ softwarelist_name, responseInfo.Extention ] = softwarelist_name.split('.');

                                    if (validExtentions.includes(responseInfo.Extention) === false)
                                        throw new Error('Bad extention');
                                    
                                    if (validNameRegEx.test(softwarelist_name) !== true)
                                        throw new Error(`bad softwarelist_name`);

                                    const software_data = await tools.databasePayload(application.DatabaseConfigs[1], 'softwarelist_payload', { softwarelist_name }, responseInfo.Extention);

                                    responseInfo.Title = software_data[0].value;
                                    responseInfo.Heading = responseInfo.Title;
                                    responseInfo.Body = software_data[1].value;
                                    break;
                            }
                            break;

                        case 'fbneo':
                            // Game
                            const datafile_key = requestInfo.UrlParts[1];
                            let game_name = requestInfo.UrlParts[2];

                            if (game_name.includes('.') === true)
                                [ game_name, responseInfo.Extention ] = game_name.split('.');

                            if (validExtentions.includes(responseInfo.Extention) === false)
                                throw new Error('Bad extention');

                            if (validNameRegEx.test(datafile_key) !== true)
                                throw new Error(`bad datafile_key`);
                        
                            if (validNameRegEx.test(game_name) !== true)
                                throw new Error(`bad game_name`);

                            const fbneo_data = await tools.databasePayload(application.DatabaseConfigs[0], 'game_payload', { datafile_key, game_name }, responseInfo.Extention);

                            responseInfo.Title = fbneo_data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = fbneo_data[1].value;
                            break;

                        case 'tosec':
                            // Datafile
                            const tosec_category = requestInfo.UrlParts[1];

                            let name = decodeURIComponent(requestInfo.UrlParts[2]);

                            validExtentions.forEach(validExtention => {
                                if (validExtention != '' && name.endsWith('.' + validExtention) == true) {
                                    responseInfo.Extention = validExtention;
                                    name = name.slice(0, -(responseInfo.Extention.length + 1));
                                }
                            });

                            const tosec_data = await tools.databasePayload(application.DatabaseConfigs[0], 'datafile_payload', { category: tosec_category, name }, responseInfo.Extention);

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
                            // Software
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

                            const data = await tools.databasePayload(application.DatabaseConfigs[1], 'software_payload', { softwarelist_name, software_name }, responseInfo.Extention);

                            responseInfo.Title = data[0].value;
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = data[1].value;
                            break;

                        case 'tosec':
                            // Game
                            const tosec_category = requestInfo.UrlParts[1];
                            const datafile_name = decodeURIComponent(requestInfo.UrlParts[2]);
                            let game_name = decodeURIComponent(requestInfo.UrlParts[3]);

                            validExtentions.forEach(validExtention => {
                                if (validExtention != '' && game_name.endsWith('.' + validExtention) == true) {
                                    responseInfo.Extention = validExtention;
                                    game_name = game_name.slice(0, -(responseInfo.Extention.length + 1));
                                }
                            });

                            const tosecData = await tools.databasePayload(application.DatabaseConfigs[0], 'game_payload', { category: tosec_category, datafile_name, game_name }, responseInfo.Extention);

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

export const getMachines = async (config: any,  search: string, offset: number, limit: number) => {

    let commandText = 'SELECT COUNT(1) OVER() [ao_total], machine.name, machine.description, machine.year, machine.manufacturer, machine.romof, machine.cloneof FROM [machine] @search ORDER BY [machine].[name] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    commandText = commandText.replace('@offset', offset.toString());
    commandText = commandText.replace('@limit', limit.toString());

    const searchParts = search.split(' ').filter(p => p != '');

    if (searchParts.length > 0)
        commandText = commandText.replace('@search', 'WHERE ([name] LIKE @search OR [description] LIKE @search)');
    else
        commandText = commandText.replace('@search', '');

    const request: Tedious.Request = new Request(commandText);

    if (searchParts.length > 0)
        request.addParameter('search', TYPES.VarChar, `%${searchParts.join('%')}%`);

    let data;

    const connection = new Connection(config);
    await tools.sqlOpen(connection);

    try {
        data = await tools.sqlRequest(connection, request);
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

run();
