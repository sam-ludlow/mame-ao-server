import http from 'http';
import os from 'os';
import cluster from 'cluster';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

import * as tools from './tools.js';

import Tedious from 'tedious';
import { Connection, Request, TYPES } from 'tedious';

var validNameRegEx = /^[a-zA-Z0-9-_]+$/;
var validUUIDRegEx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;


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
        const databaseNamePrefix = 'ao';

        switch (this.Key) {
            case 'mame':
            case 'hbmame':
                this.SubKeys = ['machine', 'software'];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `${databaseNamePrefix}-${this.Key}-machine`), tools.sqlConfig(databaseServer, `${databaseNamePrefix}-${this.Key}-software`)];
                break;

            case 'fbneo':   //  TODO: Load from DB - build menu
                this.SubKeys = ['arcade', 'channelf', 'coleco', 'fds', 'gamegear', 'megadrive', 'msx', 'neogeo', 'nes', 'ngp', 'pce', 'sg1000', 'sgx', 'sms', 'snes', 'spectrum', 'tg16', ];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `${databaseNamePrefix}-${this.Key}`)];
                break;

            case 'tosec':
                this.SubKeys = ['tosec', 'tosec-iso', 'tosec-pix'];
                this.DatabaseConfigs = [ tools.sqlConfig(databaseServer, `${databaseNamePrefix}-${this.Key}`)];
                break;

            case 'snap':
                // Not a real core
                this.Info = '';
                break;

            default:
                throw new Error(`Unknown core key: ${this.Key}`);
        }

        if (this.DatabaseConfigs.length > 0) {
            const metadata = await tools.databaseQuery(this.DatabaseConfigs[0], 'SELECT [version], [info] FROM [_metadata]');
            if (metadata.length === 0)
                throw new Error('_metadata not found');

            this.Version = metadata[0][0].value;
            this.Info = metadata[0][1].value;
        }

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
    {
        text: 'SNAP',
        title: 'Snap Home',
        href: '/snap',
    },
];

const defaultParamters: any = {
    offset: 0,
    limit: 250,
    search: '',
    view: 'grid',
    electronic: true,
    mechanical: true,
    device: true,
};

export class RequestInfo {

    public Url: string;
    public Query: string;
    public Paramters: any;
    public UrlParts: string[];
    public UrlPaths: string[];

    constructor(req: http.IncomingMessage) {

        [this.Url, this.Query] = (req.url || '/').split('?');

        this.Paramters = { ...defaultParamters };

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

                        case 'core':
                            this.Paramters.core = pair[1];
                            break;

                        case 'view':
                            if (['grid', 'list'].includes(pair[1]) === true)
                                this.Paramters.view = pair[1];
                            break;

                        case 'electronic':
                        case 'mechanical':
                        case 'device':
                            this.Paramters[pair[0]] = ['true', '1', 'yes'].includes(pair[1]);
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

const coreKeys = ['mame', 'hbmame', 'fbneo', 'tosec', 'snap'];

let mameAoDataDirectory: string = 'C:\\ao-data';
const applicationServers: any = {};
const assets: any = {};
let concurrentRequests: number = 0;

const startServer = async () => {

    if (fs.existsSync(mameAoDataDirectory) === false)
        mameAoDataDirectory = 'E:\\ao-data';    // production

    console.log(mameAoDataDirectory);

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

const readStringBody = (req: http.IncomingMessage): Promise<string> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

const requestListener: http.RequestListener = async (req: http.IncomingMessage, res: http.ServerResponse) => {

    const requestInfo = new RequestInfo(req);
    const responseInfo = new ResponeInfo();

    const now: Date = new Date();

    const forwardedFor = req.headers['x-forwarded-for'] || 'local';

    console.log(`${now.toUTCString()}\t${process.pid}\t${concurrentRequests}\t${forwardedFor}\t${req.method}\t${req.url}`);

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (concurrentRequests > 512) {
        console.log(`503\t${process.pid}\t${concurrentRequests}`);
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
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['stylesheet.css']);
            res.end();
            return;

        case '/spludlow.svg':
            res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['spludlow.svg']);
            res.end();
            return;
        
        case '/robots.txt':
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.write(assets['robots.txt']);
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
    //  API
    //
    if (requestInfo.UrlParts[0] === 'api') {

        const snapHomeDirectory = path.join(mameAoDataDirectory, 'snap-home');
        const snapMaxSize = 64 * 1024 * 1024;

        try {

            switch (requestInfo.UrlParts.length) {

                case 2:
                    switch (requestInfo.UrlParts[1]) {

                        case 'phone-home':
                            if (req.method !== 'POST')
                                throw new Error('Phone home bad method.');

                            switch (req.headers['content-type']?.split(';')[0]) {

                                case 'application/json':
                                    const snapStartTime = new Date();
                                    const body = await readStringBody(req);
                                    const token = randomUUID().toString();

                                    await savePhoneHome(snapStartTime, req, body, token);

                                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8'});
                                    res.write(JSON.stringify({ token }));
                                    break;

                                case 'image/png':
                                    let authHeader = req.headers['authorization'];
                                    if (authHeader === undefined || authHeader.startsWith('Bearer ') === false)
                                        throw new Error('authorization Bearer missing');
                                    authHeader = authHeader.substring(7);
                                    if (validUUIDRegEx.test(authHeader) === false)
                                        throw new Error('authorization Bearer format');

                                    //  TODO: Validate token in DB

                                    const snapFilename = path.join(snapHomeDirectory, `${authHeader}.png`);
                                    const fileStream = fs.createWriteStream(snapFilename);

                                    if (fs.existsSync(snapFilename))
                                        throw new Error('Snap already submitted.');

                                    let bytes = 0;
                                    req.on('data', chunk => {
                                        bytes += chunk.length;
                                        if (bytes > snapMaxSize)
                                            req.destroy(new Error('Snap too big.'));
                                    });

                                    try {
                                        await pipeline(req, fileStream);
                                    }
                                    catch (e) {
                                        fileStream.destroy();
                                        if (fs.existsSync(snapFilename))
                                            fs.unlinkSync(snapFilename);
                                        throw e;
                                    }

                                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8'});
                                    res.write(JSON.stringify({}));
                                    break;

                                default:
                                    throw new Error('Phone home bad content-type.');
                            }
                            break;

                        default:
                            throw new Error('Bad API (2) Endpoint.');
                    }
                    break;

                case 3:
                    switch (requestInfo.UrlParts[1]) {

                        case 'snap-home':
                            let submit_token = requestInfo.UrlParts[2];
                            if (submit_token.length !== 40)
                                throw new Error('expect guid.png/guid.jpg');

                            const snapExtention = submit_token.substring(36); 
                            submit_token = submit_token.slice(0, -4);

                            if (validUUIDRegEx.test(submit_token) === false)
                                throw new Error('submit_token guid format');

                            if (snapExtention !== '.png' && snapExtention !== '.jpg')
                                throw new Error('expect extention .png/.jpg');

                            const snapFilename = path.join(mameAoDataDirectory, 'snap-submit', `${submit_token}${snapExtention}`);

                            try {
                                await fs.promises.access(snapFilename, fs.constants.F_OK);
                            } catch (e: any) {
                                throw new Error(`snap home available ${e.message}`);
                            }

                            res.writeHead(200, {
                                'Content-Type': 'image/png',
                                'Cache-Control': 'public, max-age=86400',
                            });
                            
                            const readStream = fs.createReadStream(snapFilename);
                            await pipeline(readStream, res);
                            break;

                        default:
                            throw new Error('Bad API (3) Endpoint.');
                    }
                    break;

                default:
                    throw new Error('API Bad route');
            }

        } catch (e: any) {
            console.log(e);

            if (res.headersSent === false) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8'});
                res.write(JSON.stringify({ error_message: e.message }));
            }
        }
        res.end();
        return;
    }

    //
    // Menu
    //
    const walkMenu = (current: any) => {
        responseInfo.NavMenu += '<table class="nav"><tr class="nav">';
        
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
    const validExtentions = [ '', 'xml', 'json', 'html', 'png', 'jpg' ];

    const extentionContentTypes: { [key: string]: any } = {
        '': 'text/html; charset=utf-8',
        'html': 'text/html; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'xml': 'text/xml; charset=utf-8',
        'png': 'image/png',
        'jpg': 'image/jpeg',
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
                    switch (application.Key) {
                        case 'fbneo':
                            const fbneo_data = await tools.databasePayload(application.DatabaseConfigs[0], 'root_payload', { key_1: '1' }, responseInfo.Extention);
                            responseInfo.Title = fbneo_data[0].value;
                            responseInfo.Body = fbneo_data[1].value;
                            break;

                        case 'snap':
                            const [snapData, snap_totals_data] = await Promise.all([
                                tools.databaseQuery(phoneHomeDatabaseConfig, 'SELECT * FROM [snap_submit] WHERE ([status] = 0) ORDER BY [snap_submit_id] DESC'),
                                tools.databasePayload(phoneHomeDatabaseConfig, 'payload', { payload_key: 'snap-stats' }, 'html'),
                            ]);

                            let snapTable = '<table><tr><th>Snap Submitted</th><th>Uploaded</th><th>Snapped By</th><th>Core</th><th>Version</th><th>Machine</th><th>Software List</th><th>Software</th><th>Existing</th></tr>';

                            snapTable += snapData.map(dataRow => {
                                const snap_uploaded = dataRow[1].value.toISOString().slice(0, -5).replace('T', ' ');
                                const display_name = dataRow[2].value;
                                const core_name = dataRow[3].value;
                                const core_version = dataRow[4].value;
                                const machine_name = dataRow[5].value;
                                const softwarelist_name = dataRow[6].value || '';
                                const software_name = dataRow[7].value || '';
                                const existing = dataRow[8].value;
                                const image_token = dataRow[9].value;

                                const submit_url = `<a href="/api/snap-home/${image_token}.png"><img src="/api/snap-home/${image_token}.jpg" loading="lazy" alt="${machine_name}"></a>`;

                                let existing_column = 'NEW';
                                if (existing === true) {
                                    if (softwarelist_name === '')
                                        existing_column = `<a href="/${core_name}/machine/${machine_name}.png"><img src="/${core_name}/machine/${machine_name}.jpg" loading="lazy" alt="${machine_name}"></a>`;
                                    else
                                        existing_column = `<a href="/${core_name}/software/${softwarelist_name}/${software_name}.png"><img src="/${core_name}/software/${softwarelist_name}/${software_name}.jpg" loading="lazy" alt="${software_name}"></a>`;
                                }

                                return `<tr><td>${submit_url}</td><td>${snap_uploaded}</td><td>${display_name}</td><td>${core_name}</td><td>${core_version}</td><td>${machine_name}</td><td>${softwarelist_name}</td><td>${software_name}</td><td>${existing_column}</td></tr>`;
                            }).join(os.EOL);

                            snapTable += '</table>';

                            responseInfo.Info = snap_totals_data[0].value;

                            snapTable += `<hr />`;
                            snapTable += snap_totals_data[1].value;

                            responseInfo.Title = 'Snap Home';
                            responseInfo.Heading = responseInfo.Title;
                            responseInfo.Body = '<h2>Submissions</h2><p>MAME-AO Snap Home pictures are displayed here see the <a href="https://github.com/sam-ludlow/mame-ao?tab=readme-ov-file#snap-home">README</a> for more details.</p>' +
                                '<p>Please allow a few minutes for this page to get updated. Submittions will be reviewed, if aproved they will be assimilated.</p>' +
                                snapTable;

                            break;

                        default:
                            responseInfo.Title = `${application.Key.toUpperCase()} (${application.Version})`;
                            responseInfo.Body = assets[`${application.Key}.html`];
                            break;
                    }
                    responseInfo.Heading = responseInfo.Title;

                    break;

                case 2:
                    switch (requestInfo.UrlParts[0]) {
                        case 'mame':
                        case 'hbmame':
                            switch (requestInfo.UrlParts[1]) {
                                case 'machine':
                                    const displayMode: string = requestInfo.Paramters.view === 'grid' ? 'html_card' : 'html';

                                    // Machine Search
                                    const pageData = await getMachines(application.DatabaseConfigs[0], requestInfo.Paramters.search, requestInfo.Paramters.offset, requestInfo.Paramters.limit,
                                        displayMode, requestInfo.Paramters.electronic, requestInfo.Paramters.mechanical, requestInfo.Paramters.device);

                                    let viewCount = pageData.length;
                                    let totalCount = viewCount === 0 ? 0 : pageData[0].filter((r: any) => r.metadata.colName === 'ao_total')[0].value;

                                    const goLocationUrl = (offset: number) => {
                                        const paramters = { ...requestInfo.Paramters };
                                        paramters.offset = offset;

                                        const parts: string[] = Object.keys(requestInfo.Paramters).filter(key => paramters[key] !== defaultParamters[key]);

                                        if (parts.length === 0)
                                            return requestInfo.Url;

                                        return requestInfo.Url + '?' + parts.map((key) => `${key}=${encodeURIComponent(paramters[key])}`).join('&');
                                    };

                                    let nav = '';
                                    let prevOffset = requestInfo.Paramters.offset - requestInfo.Paramters.limit;
                                    if (prevOffset >= 0)
                                        nav += `<a href="${goLocationUrl(prevOffset)}">PREV</a> &bull; `;
                                    else
                                        nav += 'PREV &bull; ';


                                    let nextOffset = requestInfo.Paramters.offset + requestInfo.Paramters.limit;
                                    if (nextOffset < totalCount)
                                        nav += `<a href="${goLocationUrl(nextOffset)}">NEXT</a> &bull; `;
                                    else
                                        nav += 'NEXT &bull; ';

                                    nav += `view:${viewCount} total:${totalCount}`;

                                    let machineHtml = '';

                                    switch (displayMode) {

                                        case 'html':
                                            const columnDefs = {
                                                'name': 'Name',
                                                'description': 'Description',
                                                'year': 'Year',
                                                'manufacturer': 'Manufacturer',
                                                'cloneof': 'Clone of',
                                                'romof': 'Rom of',
                                            };

                                            machineHtml = `<table><tr>`;
                                            machineHtml += Object.keys(columnDefs).map(columnName => `<th>${columnName}</th>`).join('');
                                            machineHtml += '</tr>' + os.EOL;
                                            
                                            pageData.forEach((row) => {
                                                machineHtml += row[1].value + os.EOL;
                                            });
                                            
                                            machineHtml += '</table>';
                                            break;

                                        case 'html_card':
                                            machineHtml = '<div class="card-grid">';
                                            pageData.forEach((row) => {
                                                machineHtml += row[1].value + os.EOL;
                                            });
                                            machineHtml += '</div>' + os.EOL;
                                            break;

                                        default:
                                            throw new Error(`Bad display mode ${displayMode}`);
                                    }

                                    machineHtml = assets['mame-machine.html'].replace('@DATA@', machineHtml);
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

                                    if (responseInfo.Extention === 'png' || responseInfo.Extention === 'jpg') {
                                        responseInfo.Title = '@stream';
                                        responseInfo.Body = path.join(mameAoDataDirectory, 'snap', requestInfo.UrlParts[0], responseInfo.Extention, `${machine_name}.${responseInfo.Extention}`);

                                    } else {
                                        const data = await tools.databasePayload(application.DatabaseConfigs[0], 'machine_payload', { machine_name }, responseInfo.Extention);

                                        responseInfo.Title = data[0].value;
                                        responseInfo.Heading = responseInfo.Title;
                                        responseInfo.Body = data[1].value;
                                    }
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

                            if (responseInfo.Extention === 'png' || responseInfo.Extention === 'jpg') {
                                responseInfo.Title = '@stream';
                                responseInfo.Body = path.join(mameAoDataDirectory, 'snap', requestInfo.UrlParts[0], responseInfo.Extention, softwarelist_name, `${software_name}.${responseInfo.Extention}`);

                            } else {
                                const data = await tools.databasePayload(application.DatabaseConfigs[1], 'software_payload', { softwarelist_name, software_name }, responseInfo.Extention);

                                responseInfo.Title = data[0].value;
                                responseInfo.Heading = responseInfo.Title;
                                responseInfo.Body = data[1].value;
                            }
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

        switch (responseInfo.Title)
        {
            case '@stream':
                try {
                    await fs.promises.access(responseInfo.Body, fs.constants.F_OK);
                } catch (e: any) {
                    throw new Error(`snap not available ${e.message}`);
                }

                res.writeHead(200, {
                    'Content-Type': extentionContentTypes[responseInfo.Extention],
                    'Cache-Control': 'public, max-age=86400',
                });
                
                const readStream = fs.createReadStream(responseInfo.Body);
                await pipeline(readStream, res);

                break;

            default:
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
                break;
        }


    }
    catch (e) {
        const error = e as Error;
        console.log(error);

        if (res.headersSent === false) {
            const status = 400;

            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8'});

            const errorBody: any = {
                status,
                name: error.name,
                message: error.message,
                stack: error.stack,
            };

            res.write(JSON.stringify(errorBody, null, '\t'));
        }
    }
    finally {
        concurrentRequests--;
        res.end();
    }
}

const phoneHomeDatabaseConfig = tools.sqlConfig('my-mssql-server', 'ao-master');

const savePhoneHome = async (startTime: Date, req: http.IncomingMessage, body: string, token: string) => {

    const commandText = `
        INSERT INTO [phone_home] ([request_time], [request_address], [request_agent], [response_time], [body_length], [body], [status], [token])
        VALUES (@request_time, @request_address, @request_agent, @response_time, @body_length, @body, @status, @token);
    `;
    const request: Tedious.Request = new Request(commandText, () => {});

    let address = req.headers['x-forwarded-for'] || 'local';
    if (Array.isArray(address))
        address = address[0];

    request.addParameter('request_time', TYPES.DateTime2, startTime);
    request.addParameter('request_address', TYPES.VarChar, address.split(':')[0]);
    request.addParameter('request_agent', TYPES.NVarChar, req.headers['user-agent'] || '');
    request.addParameter('response_time', TYPES.Int, Date.now() - startTime.getTime());
    request.addParameter('body_length', TYPES.Int, body.length);
    request.addParameter('body', TYPES.NVarChar, body);
    request.addParameter('status', TYPES.Int, 0);
    request.addParameter('token', TYPES.Char, token);

    const connection = new Connection(phoneHomeDatabaseConfig);
    await tools.sqlOpen(connection);
    try {
        await tools.sqlRequest(connection, request);
    }
    finally {
        await tools.sqlClose(connection);
    }
}

export const getMachines = async (config: any,  search: string, offset: number, limit: number, payloadColumnName: string, iselectronic: boolean, ismechanical: boolean, isdevice: boolean) => {

    let commandText;

    if (search.length > 0) {
        commandText = `
            WITH tmp_search_rows AS (
                SELECT
                    machine_search_payload.[${payloadColumnName}],
                    machine_search_payload.[description],
                    seacrh_result.[RANK],
                    COUNT(*) OVER() AS ao_total
                FROM FREETEXTTABLE(
                        machine_search_payload,
                        ([name], [description]),
                        @search
                    ) AS seacrh_result
                JOIN machine_search_payload AS machine_search_payload
                    ON machine_search_payload.[name] = seacrh_result.[KEY]
                WHERE (@iselectronic = 1 AND iselectronic = 1) OR (@ismechanical = 1 AND ismechanical = 1) OR (@isdevice = 1 AND isdevice = 1)
            )
            SELECT
                ao_total,
                [${payloadColumnName}],
                [RANK]
            FROM tmp_search_rows
            ORDER BY [RANK] DESC, [description] ASC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY;
        `;
    } else {
        commandText = `
            SELECT tmp_total_rows.[ao_total], tmp_page_rows.[${payloadColumnName}]
            FROM (
                SELECT COUNT(*) AS ao_total
                FROM machine_search_payload
                WHERE (@iselectronic = 1 AND iselectronic = 1) OR (@ismechanical = 1 AND ismechanical = 1) OR (@isdevice = 1 AND isdevice = 1)
            ) tmp_total_rows
            CROSS JOIN (
                SELECT [${payloadColumnName}]
                FROM machine_search_payload
                ORDER BY description
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            ) tmp_page_rows;
        `;
    }

    commandText = commandText.replace('@offset', offset.toString());
    commandText = commandText.replace('@limit', limit.toString());

    const request: Tedious.Request = new Request(commandText, () => {});

    if (search.length > 0)
        request.addParameter('search', TYPES.VarChar, search);

    request.addParameter('iselectronic', TYPES.Bit, iselectronic);
    request.addParameter('ismechanical', TYPES.Bit, ismechanical);
    request.addParameter('isdevice', TYPES.Bit, isdevice);

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

//
// Cluster
//
const runCluster = async () => {
    if (cluster.isPrimary === true) {

        console.log(`Master ${process.pid} running`);
        
        process.stdin.on('data', (chunk: Buffer) => {
            const command: string = chunk.toString().trim();
            console.log(`COMMAND: ${process.pid} ${command}`);

            if (command === 'stop')
                process.exit(0);
        });

        for (let i = 0; i < 4; ++i)
            cluster.fork();

        cluster.on("exit", (worker) => {
            console.log(`Slave ${worker.process.pid} died.`);
            //cluster.fork();
        });

        const masterServer: http.Server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {

            const requestInfo = new RequestInfo(req);

            if (requestInfo.UrlParts.length === 2 && requestInfo.UrlParts[0] === 'api') {

                res.setHeader('Content-Type', 'application/json; charset=utf-8');

                try {
                    switch (requestInfo.UrlParts[1]) {

                        case 'stop':
                        case 'start':
                            for (const id in cluster.workers) {
                                const worker = cluster.workers[id];
                                if (worker)
                                    worker.send(`${requestInfo.UrlParts[1]}\t${requestInfo.Paramters.core}`);
                            }
                            break;

                        default:
                            throw new Error('Bad EP.');
                    }

                    res.write(JSON.stringify({ message: 'OK' }));

                } catch (e: any) {
                    console.log(e);
                    res.write(JSON.stringify({ error_message: e.message }));
                }
            }

            res.end();
        });

        masterServer.listen(32104);

    } else {

        console.log(`Starting\t${process.pid}`);
        try {

            await startServer();
            
            process.on("message", async (message: string) => {

                const messageParts = message.split('\t');
                const core = messageParts[1];

                switch (messageParts[0]) {
                    case 'stop':
                        delete applicationServers[core];
                        console.log(`slave stopped ${process.pid} ${core}`);
                        break;
                    case 'start':
                        const app = new ApplicationCore(core);
                        await app.initialize();
                        applicationServers[core] = app;
                        console.log(`slave started ${process.pid} ${core}`);
                        break;
                    default:
                        console.log(`slave bad message ${process.pid} ${message}`);
                        break;
                }
            });

            console.log(`Started\t${process.pid}`);
        } catch (e: any) {
            console.log(`Error Starting\t${process.pid}\t${e}\t${e.stack}`);
        }
    }
}

runCluster();
