import Tedious from 'tedious';

var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

import * as tools from './tools';

export const getMachine = async (machine_name: string, extention: string) => {

    if (extention === '')
        extention = 'html';

    const sqlConfig = tools.sqlConfig('SPLCAL-MAIN', 'MameAoMachine');
    const connection: Tedious.Connection = new Connection(sqlConfig);
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request(`SELECT [title], [${extention}] FROM [machine_payload] WHERE ([machine_name] = @machine_name)`);
        request.addParameter('machine_name', TYPES.VarChar, machine_name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('Machine not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getSoftware = async (softwarelist_name: string, software_name: string, extention: string) => {

    if (extention === '')
        extention = 'html';

    const sqlConfig = tools.sqlConfig('SPLCAL-MAIN', 'MameAoSoftware');
    const connection: Tedious.Connection = new Connection(sqlConfig);
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request(`SELECT [title], [${extention}] FROM [software_payload] WHERE ([softwarelist_name] = @softwarelist_name AND [software_name] = @software_name)`);
        request.addParameter('softwarelist_name', TYPES.VarChar, softwarelist_name);
        request.addParameter('software_name', TYPES.VarChar, software_name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('Software not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getSoftwareList = async (softwarelist_name: string, extention: string) => {

    if (extention === '')
        extention = 'html';
    
    const sqlConfig = tools.sqlConfig('SPLCAL-MAIN', 'MameAoSoftware');
    const connection: Tedious.Connection = new Connection(sqlConfig);
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request(`SELECT [title], [${extention}] FROM [softwarelist_payload] WHERE ([softwarelist_name] = @softwarelist_name)`);
        request.addParameter('softwarelist_name', TYPES.VarChar, softwarelist_name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('Software List not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getSoftwareLists = async () => {

    const sqlConfig = tools.sqlConfig('SPLCAL-MAIN', 'MameAoSoftware');
    const connection: Tedious.Connection = new Connection(sqlConfig);
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [softwarelists_payload]');

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('Software Lists not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}