import Tedious from 'tedious';

var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

import * as tools from './tools';

export const getFBNeoGame = async (datafile_key: string, game_name: string) => {

    const connection: Tedious.Connection = tools.sqlConnection('fbneo', 'dataset');
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [game_payload] WHERE ([datafile_key] = @datafile_key AND [game_name] = @game_name)');
        request.addParameter('datafile_key', TYPES.VarChar, datafile_key);
        request.addParameter('game_name', TYPES.VarChar, game_name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('FBNeo Game not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getFBNeoDataFile = async (key: string) => {

    const connection: Tedious.Connection = tools.sqlConnection('fbneo', 'dataset');
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [datafile_payload] WHERE ([key] = @key)');
        request.addParameter('key', TYPES.VarChar, key);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('FBNeo datafile not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}



export const getTosecDataFiles = async (category: string) => {

    const connection: Tedious.Connection = tools.sqlConnection('tosec', 'dataset');
    await tools.sqlOpen(connection);

    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [category_payload] WHERE (category = @category)');
        request.addParameter('category', TYPES.VarChar, category);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('TOSEC category not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getTosecDataFile = async (category: string, name: string) => {

    const connection: Tedious.Connection = tools.sqlConnection('tosec', 'dataset');
    await tools.sqlOpen(connection);
    
    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [datafile_payload] WHERE ([category] = @category AND [name] = @name)');
        request.addParameter('category', TYPES.VarChar, category);
        request.addParameter('name', TYPES.VarChar, name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('TOSEC datafile not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getTosecGame = async (category: string, datafile_name: string, game_name: string) => {

    const connection: Tedious.Connection = tools.sqlConnection('tosec', 'dataset');
    await tools.sqlOpen(connection);
    
    let data: any[] = [];
    try {

        const request: Tedious.Request = new Request('SELECT [title], [html] FROM [game_payload] WHERE ([category] = @category AND [datafile_name] = @datafile_name AND [game_name] = @game_name)');
        request.addParameter('category', TYPES.VarChar, category);
        request.addParameter('datafile_name', TYPES.VarChar, datafile_name);
        request.addParameter('game_name', TYPES.VarChar, game_name);

        const response = await tools.sqlRequest(connection, request);

        if (response.length === 0)
            throw new Error('TOSEC game not found');

        data = response[0];
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getMachine = async (machine_name: string, extention: string, dataset: string) => {

    if (extention === '')
        extention = 'html';

    const connection: Tedious.Connection = tools.sqlConnection(dataset, 'machine');
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

export const getMachines = async (search: string, offset: number, limit: number, dataset: string) => {

    const connection: Tedious.Connection = tools.sqlConnection(dataset, 'machine');

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

    let data: any[] = [];

    await tools.sqlOpen(connection);

    try {
        data = await tools.sqlRequest(connection, request);
    }
    finally {
        await tools.sqlClose(connection);
    }

    return data;
}

export const getSoftware = async (softwarelist_name: string, software_name: string, extention: string, dataset: string) => {

    if (extention === '')
        extention = 'html';

    const connection: Tedious.Connection = tools.sqlConnection(dataset, 'software');

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

export const getSoftwareList = async (softwarelist_name: string, extention: string, dataset: string) => {

    if (extention === '')
        extention = 'html';
    
    const connection: Tedious.Connection = tools.sqlConnection(dataset, 'software');
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

export const getSoftwareLists = async (dataset: string) => {

    const connection = tools.sqlConnection(dataset, 'software');
    console.log(dataset);
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