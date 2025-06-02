import http from 'http';

import * as mame from './mame';

var validNameRegEx = /^[a-zA-Z0-9-_]+$/;

const favIconBase64 = `
    AAABAAEAEBAAAAAAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAMAAAAAAAAAAAAAAAAA
    AAAAAAD0tgDzuQDzsgD2xgD99NT++OP++OX++OX/+OPA67QA6t3j6KL/9tr++OP9+OX9+OX0vQD0
    vgD99dj///T/75P/6m7/6mv/6Wz/4ne+3G4A7Obg2EL/3F7/3Vv/32v84nnysAD99+P/9MThrQCV
    aACCXQCCXQCgcgDyoQC9vwAA8PesvwCDyQB/ygDQswD/rQD0uwD//e/vsgBEMgAJDiUdGh8bGh8H
    DCZzTADEwwAA8/8A8/8A8/8A8/8A8fjBwwD+/PX/1gC+hgAUFiLCjQDvrQDysACgdgAsGgyxtQAA
    +P873pbetQDbtQAN5LcA79X//vv2uwDkogDQlwDoqADdoADlpwCRawAtGwuwtgAA9v7AvAD/qgD/
    qQCpwgAA+f/+/PXztQD9tQCqfQAgHBwUFiIWFiIFCid8UgDAwwAA8PfXtgD3rQD7rAC+vQAA9//+
    /PX4ugDYmwAbGR9cRgCZcQCRagCtfwD/swC9wQAA8PvUtwD5rQD8rAC9vQAA+P///fn+wgC2gwAX
    FyHqqgD/xAD/xADcnwB8UwCytwAA9/+MywD/qAD/qAB10ToA9////fX7zwDYmAAeGx5vVACgdgCi
    dwBRPgA2IQG5vAAA9v8A8f9z0URv0kkA9v9p2Vj76Jv977v7sgCQaQASEyITFCISEyIdGh+6fwDH
    xQAA7uwg4a4A8/8A9P9U12/7swDzuQD//fn1wAD2rgDbngDUmQDTmQDhowD6swDqsQDSuADyrwDX
    tgDVswD5sgD/7KDxrgD977/98MbzsAD3sAD4swD4swD2sgDyrwD0rgD5rQD0rwD3qQD5swD+8MD/
    /vPxrADysAD+/fX75Y7ysgDxqwDyrgDyrwDyrwDyrwDyrgDxqgDztQD977n99+D0swDyrwDxqwDz
    sgD//fn98sz0vwDyrgDxqwDxqgDxqwDyrwD1xQD9+OL+/PXysgD1rADyrwDyrwDxrQDztQD889D/
    /fn989P75pT53mj76J399dv//fn87rjzswDyrADxrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
`;

const masterHtml = `<!DOCTYPE html>

<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width">
    <link href="/stylesheet.css" rel="stylesheet" type="text/css" />

    <script type="text/javascript">

    </script>

</head>
<body>
    <div style="position:relative;width:100%;">

        <div style="width:100%; height:90px; background:black;">

            <a href="/" style="float: left">
                <img src="/spludlow.svg" alt="spludlow logo" />
            </a>

            <h1 style="color: white;">@H1@</h1>


        </div>

    </div>
    
    <hr />
    <nav>
        @NAV@
    </nav>
    <hr />
    <div style="font-size: 12px; font-weight: bold;">
        @INFO@
    </div>
    <hr />

    @BODY@

    <hr />
    <div style="width:100%; height:40px; background:black;">
    </div>
</body>
</html>
`;

const style = `
body {
	font-family: sans-serif;
	font-size: small;
	background-color: #c6eafb;
}

hr {
	color: #00ADEF;
	background-color: #00ADEF;
	height: 6px;
	border: none;
	padding-left: 0px;
}

	hr.px2 {
		color: #00ADEF;
		background-color: #00ADEF;
		height: 2px;
		border: none;
		padding-left: 0px;
	}

table {
	border-collapse: collapse;
	font-size: small;
}

th, td {
	padding: 2px;
	text-align: left;
}

table, th, td {
	border: 1px solid black;
}

th {
	background-color: #00ADEF;
	color: white;
}

tr:nth-child(even) {
	background-color: #b6daeb;
}

a.nav-off {
	text-decoration: none;
	color: #FFFFFF;
}

a.nav-on {
	text-decoration: none;
	color: #FFFF00;
}

td.nav-off {
	text-decoration: none;
	background-color: #1a75bc;
	text-align: center;
}

td.nav-on {
	text-decoration: none;
	background-color: #00ADEF;
	text-align: center;
}
`;

const logo = `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 width="160px" height="90px" xml:space="preserve">
<style type="text/css">
	.st0{fill:#00BDFF;}
	.st1{fill:#FFFFFF;}
	.st2{fill:#FFF100;}
</style>
<g>
	<path class="st0" d="M30.44,46.17v-0.31c0-3.42-2.77-6.19-6.19-6.19h-5.89c-3.42,0-6.19,2.77-6.19,6.19c0,3.42,2.77,6.19,6.19,6.19
		h5.89c1.46,0,2.64,1.18,2.64,2.64c0,1.45-1.18,2.64-2.64,2.64h-5.89c-1.46,0-2.64-1.18-2.64-2.64V54.4h-3.55v0.31
		c0,3.42,2.77,6.19,6.19,6.19h5.89c3.42,0,6.19-2.77,6.19-6.19c0-3.42-2.77-6.19-6.19-6.19h-5.89c-1.46,0-2.64-1.18-2.64-2.64
		c0-1.46,1.18-2.64,2.64-2.64h5.89c1.46,0,2.64,1.18,2.64,2.64v0.31H30.44z"/>
	<path class="st0" d="M59.57,63.22c-1.46,0-2.64-1.18-2.64-2.64V30.85h-3.55v29.74c0,3.42,2.77,6.19,6.19,6.19h0.3v-3.55H59.57z"/>
	<path class="st0" d="M144.62,39.68v0.31V54.7c0,1.46-1.18,2.64-2.64,2.64c-1.46,0-2.64-1.18-2.64-2.64v-9.13h-3.55v9.13v0
		c0,1.45-1.18,2.63-2.64,2.64c-1.46,0-2.64-1.18-2.64-2.64V39.68h-3.55V54.7c0,3.42,2.77,6.19,6.19,6.19c1.73,0,3.29-0.72,4.42-1.86
		c1.12,1.14,2.68,1.86,4.41,1.86c3.42,0,6.19-2.77,6.19-6.19V39.68H144.62z"/>
	<path class="st0" d="M73.98,39.68v0.31v11.77c0,1.54-0.62,2.93-1.64,3.95c-1.01,1.01-2.4,1.63-3.95,1.63
		c-1.54,0-2.94-0.62-3.95-1.63c-1.01-1.01-1.64-2.4-1.64-3.95V39.68h-3.55v12.08c0,5.04,4.09,9.13,9.13,9.13
		c2.1,0,4.04-0.72,5.58-1.91v1.91h3.55V39.68H73.98z"/>
	<path class="st0" d="M115.49,39.68c-5.05,0-9.14,4.09-9.14,9.13v2.94c0,5.04,4.09,9.13,9.14,9.13c5.04,0,9.13-4.09,9.13-9.13v-2.94
		C124.63,43.77,120.54,39.68,115.49,39.68 M121.07,51.76c0,1.54-0.62,2.93-1.63,3.95c-1.01,1.01-2.4,1.63-3.95,1.63
		c-1.54,0-2.94-0.62-3.95-1.63c-1.01-1.01-1.64-2.4-1.64-3.95v-2.94c0-1.54,0.63-2.93,1.64-3.95c1.01-1.01,2.4-1.63,3.95-1.63
		c1.54,0,2.94,0.62,3.95,1.63c1.01,1.01,1.63,2.4,1.63,3.95V51.76z"/>
	<path class="st0" d="M106.66,63.22c-1.46,0-2.64-1.18-2.64-2.64V30.85h-3.55v29.74c0,3.42,2.77,6.19,6.19,6.19h0.3v-3.55H106.66z"
		/>
	<path class="st1" d="M78.7,4.36c-13.98,0-25.32,11.34-25.32,25.32v0.3h3.55v-0.3c0-6.01,2.44-11.45,6.38-15.39
		c3.94-3.94,9.38-6.38,15.39-6.38c6.01,0,11.45,2.44,15.39,6.38c3.94,3.94,6.38,9.38,6.38,15.39v0.3h3.55v-0.3
		C104.02,15.7,92.68,4.36,78.7,4.36"/>
	<path class="st1" d="M52.39,36.54c-2.16-1.06-4.13-2.47-5.82-4.16l0,0l0,0l-0.33-0.32l0,0l0,0c-4.55-4.39-10.75-7.09-17.57-7.09
		c-13.99,0-25.32,11.34-25.32,25.32c0,9.11,7.38,16.49,16.49,16.49h12.08v-3.55H19.83c-3.57,0-6.81-1.45-9.15-3.79
		c-2.34-2.34-3.79-5.58-3.79-9.15c0-6.01,2.44-11.45,6.38-15.39c3.94-3.94,9.38-6.38,15.39-6.38c6.01,0,11.45,2.44,15.39,6.38
		l0.22,0.22l0.22,0.21l0.01-0.01c2.2,2.1,4.78,3.81,7.62,5.02l0.42,0.18v-3.88L52.39,36.54z"/>
	<path class="st1" d="M131.68,24.96c-6.82,0-13.02,2.7-17.57,7.09l-0.33,0.33h0l0,0c-2.4,2.4-5.37,4.25-8.68,5.32l-0.21,0.07v3.7
		l0.39-0.11c4.02-1.14,7.63-3.24,10.57-6.04l0.01,0.01l0.44-0.43l0,0c3.94-3.94,9.38-6.38,15.39-6.38c6.01,0,11.45,2.44,15.39,6.38
		c3.94,3.94,6.38,9.38,6.38,15.39c0,3.57-1.45,6.81-3.79,9.15c-2.34,2.34-5.58,3.79-9.15,3.79h-32.68v3.55h32.68
		c9.11,0,16.49-7.39,16.49-16.49C157,36.3,145.66,24.96,131.68,24.96"/>
	<path class="st1" d="M102.43,66.23c-0.97-0.73-1.74-1.7-2.23-2.82l-0.08-0.18h-0.2H60.74v3.55h42.42L102.43,66.23z"/>
	<path class="st1" d="M55.34,66.23c-0.97-0.73-1.74-1.7-2.23-2.82l-0.08-0.18h-0.2H37.19v3.55h18.88L55.34,66.23z"/>
	<path class="st2" d="M41.91,39.68c-2.1,0-4.04,0.72-5.58,1.91v-1.91h-3.55v9.13v2.94v20.91h2.33l-2.48,5.89h1.8h0.76l-3.02,6.93
		L42.65,75h-5.06l4.75-5.59l-0.24-0.22l-0.09-0.08h-3.34h-0.61h-1.74V58.98c1.54,1.2,3.48,1.91,5.58,1.91
		c5.05,0,9.13-4.09,9.13-9.13v-2.94C51.04,43.77,46.96,39.68,41.91,39.68 M41.91,57.34c-3.08,0-5.58-2.5-5.58-5.58v-2.95
		c0-1.54,0.62-2.94,1.63-3.95c1.01-1.01,2.4-1.63,3.95-1.63c1.54,0,2.94,0.62,3.95,1.63c1.01,1.01,1.64,2.4,1.64,3.95v2.94
		c0,1.54-0.63,2.93-1.64,3.95C44.85,56.71,43.45,57.34,41.91,57.34"/>
	<path class="st2" d="M78.7,10.25h-0.3v3.55h0.3c4.39,0,8.36,1.78,11.23,4.65c2.87,2.87,4.65,6.84,4.65,11.23v11.91
		c-1.54-1.2-3.48-1.91-5.58-1.91c-5.04,0-9.13,4.09-9.13,9.13v2.94v0c0,5.04,4.09,9.13,9.13,9.13c2.1,0,4.04-0.72,5.58-1.91v1.91
		h3.55v-9.13v0v-2.94V29.68C98.14,18.95,89.44,10.25,78.7,10.25 M94.58,51.76L94.58,51.76c0,1.54-0.62,2.94-1.64,3.95
		c-1.01,1.01-2.4,1.63-3.95,1.63c-1.54,0-2.94-0.62-3.95-1.63c-1.01-1.01-1.63-2.4-1.63-3.95v0v-2.94c0-1.54,0.62-2.93,1.63-3.95
		c1.01-1.01,2.4-1.63,3.95-1.63c3.08,0,5.58,2.5,5.58,5.58V51.76z"/>
</g>
</svg>
`;

const favIcon = Buffer.from(favIconBase64, 'base64');

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
            res.setHeader("Content-Type", "image/x-icon");
            res.write(favIcon);
            res.end();
            return;

        case '/stylesheet.css':
            res.setHeader("Content-Type", "text/css");
            res.write(style);
            res.end();
            return;

        case '/spludlow.svg':
            res.setHeader("Content-Type", "image/svg+xml");
            res.write(logo);
            res.end();
            return;

        default:
            break;
    }



    let urlParts = (req.url || '/').split('/').filter(u => u !== '');
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


        if (urlParts.length === 0) {

            data = [ {value: 'Spludlow Data Web'}, {value: '<ul><li><a href=\"/mame\">MAME</a></li></ul>'} ]
        }

        if (urlParts.length === 1 && urlParts[0] === 'mame') {

            const page =`
            <h2>mame data subsets</h2><ul><li><a href=\"/mame/machine\">machine</a></li><li><a href=\"/mame/software\">software</a></li></ul>
            `;

            data = [ {value: 'Spludlow Data Web'}, {value: page } ]
        }

        if (urlParts.length === 2 && urlParts[0] === 'mame' && urlParts[1] === 'machine') {
            
            const page =`
            <p>this page is not ready, but you can access the data pages using the address bar, for example:</p><ul><li><a href=\"/mame/machine/mrdo\">/mame/machine/mrdo</a></li><li><a href=\"/mame/machine/bbcb\">/mame/machine/bbcb</a></li></ul>
            `;

            data = [ {value: 'Spludlow Data Web'}, {value: page } ]

        }

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

            let html = masterHtml;
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

const server: http.Server = http.createServer(requestListener);
server.listen(32103);
