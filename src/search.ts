import os from 'os';
import Tedious from 'tedious';
import { Connection, Request, TYPES } from 'tedious';

import * as tools from './tools.js';
import { Application, applicationServers } from './index.js';

export const searchRomDisk = async (value: string) => {

    let name = 'name';
    if (tools.validSHA1RegEx.test(value) === true)
        name = 'sha1';
    else if (tools.validCRC32RegEx.test(value) === true)
        name = 'crc';

    const databaseSearch = async (type: string, application: Application, connectionIndex: number, commandText: string) => {

        const request: Tedious.Request = new Request(commandText.replace('@NAME', name), () => {});
        request.addParameter('VALUE', TYPES.VarChar, value);
        
        const data = await tools.databaseRequest(application.DatabaseConfigs[connectionIndex], request);

        if (data.length === 0)
            return '';

        const results = data.map((row) => Object.fromEntries(row.map((item: any) => [item.metadata.colName, item.value])));

        const columnNameSet = new Set<string>();
        for (const result of results)
            for (const name of Object.keys(result))
                columnNameSet.add(name);
        const columnNames = Array.from(columnNameSet);

        let html = `<h2>${type}</h2>`;
        
        html += `<table><tr>${columnNames.map(name => `<th>${name}</th>`).join('')}</tr>`;
        html += results.map((result: any) => {
            return `<tr>${columnNames.map(name => {
                let value = result[name];
                switch (name) {
                    case 'machine_name':
                        value = `<a href="/${application.Key}/machine/${value}">${value}</a>`;
                        break;

                    case 'softwarelist_name':
                        value = `<a href="/${application.Key}/software/${value}">${value}</a>`;
                        break;

                    case 'software_name':
                        value = `<a href="/${application.Key}/software/${result['softwarelist_name']}/${value}">${value}</a>`;
                        break;

                    case 'datafile_name':
                        value = `<a href="/${application.Key}/${value}">${value}</a>`;
                        break;

                    case 'game_name':
                        value = `<a href="/${application.Key}/${result['datafile_name']}/${value}">${value}</a>`;
                        break;

                    case 'tosec_category':
                        value = `<a href="/${application.Key}/${value}">${value}</a>`;
                        break;

                    case 'tosec_datafile_name':
                        value = `<a href="/${application.Key}/${result['tosec_category']}/${encodeURIComponent(value)}">${tools.encodeHTML(value)}</a>`;
                        break;

                    case 'tosec_game_name':
                        value = `<a href="/${application.Key}/${result['tosec_category']}/${encodeURIComponent(result['tosec_datafile_name'])}/${encodeURIComponent(value)}">${tools.encodeHTML(value)}</a>`;
                        break;

                    case 'rank':
                        value = `${value}`;
                        break;

                    default:
                        value = tools.encodeHTML(value);
                }
                return `<td>${value}</td>`}).join('')}</tr>`;
        }).join(os.EOL);
        html += '</table>';

        return html;
    };

    const tasks: Promise<string>[] = [];

    let application: Application | undefined;

    if (application = applicationServers['mame']) {

        tasks.push(databaseSearch('MAME Machine ROM', application, 0, `
            SELECT
                [machine].[name] AS machine_name,
                [machine].[description] AS machine_description,
                [rom].[name], [rom].[size], [rom].[sha1], [rom].[crc]
            FROM
                [machine]
                INNER JOIN [rom] ON [machine].machine_id = [rom].machine_id
            WHERE [rom].[@NAME] = @VALUE;
        `));
        if (name !== 'crc')
            tasks.push(databaseSearch('MAME Machine DISK', application, 0, `
                SELECT
                    [machine].[name] AS machine_name,
                    [machine].[description] AS machine_description,
                    [disk].[name], '' AS [size], [disk].[sha1], '' AS [crc]
                FROM
                    [machine]
                    INNER JOIN [disk] ON [machine].machine_id = [disk].machine_id
                WHERE [disk].[@NAME] = @VALUE;
            `));
        tasks.push(databaseSearch('MAME Software ROM', application, 1, `
            SELECT
                softwarelist.[name] AS softwarelist_name,
                softwarelist.[description] AS softwarelist_description,
                software.[name] AS software_name,
                software.[description] AS software_description,
                [rom].[name], [rom].[size], [rom].[sha1], [rom].[crc]
            FROM
                softwarelist
                INNER JOIN software ON softwarelist.softwarelist_id = software.softwarelist_id
                INNER JOIN part ON software.software_id = part.software_id
                INNER JOIN dataarea ON part.part_id = dataarea.part_id
                INNER JOIN rom ON dataarea.dataarea_id = rom.dataarea_id
            WHERE
                [rom].[@NAME] = @VALUE;
        `));
        if (name !== 'crc')
            tasks.push(databaseSearch('MAME Software DISK', application, 1, `
                SELECT
                    softwarelist.[name] AS softwarelist_name,
                    softwarelist.[description] AS softwarelist_description,
                    software.[name] AS software_name,
                    software.[description] AS software_description,
                    [disk].[name], '' AS [size], [disk].[sha1], '' AS [crc]
                FROM
                    softwarelist
                    INNER JOIN software ON softwarelist.softwarelist_id = software.softwarelist_id
                    INNER JOIN part ON software.software_id = part.software_id
                    INNER JOIN diskarea ON part.part_id = diskarea.part_id
                    INNER JOIN [disk] ON diskarea.diskarea_id = [disk].diskarea_id
                WHERE [disk].[@NAME] = @VALUE;
            `));

        if (name === 'name')
            tasks.push(databaseSearch('MAME Machine', application, 0, `
                SELECT
                    machine_search_payload.[name] AS [machine_name],
                    machine_search_payload.[description] AS [machine_description],
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        machine_search_payload,
                        ([name], [description]),
                        @VALUE
                    ) AS search_result
                JOIN machine_search_payload AS machine_search_payload
                    ON machine_search_payload.[name] = search_result.[KEY]
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));

        if (name === 'name')
            tasks.push(databaseSearch('MAME Software', application, 1, `
                SELECT
                    software_search_payload.[softwarelist_name],
                    software_search_payload.[software_name],
                    software_search_payload.[description] AS [software_description],
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        software_search_payload,
                        ([software_name], [description]),
                        @VALUE
                    ) AS search_result
                JOIN software_search_payload AS software_search_payload
                    ON software_search_payload.[key] = search_result.[KEY]
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));
    }

    if (application = applicationServers['hbmame']) {

        tasks.push(databaseSearch('HBMAME Machine ROM', application, 0, `
            SELECT
                [machine].[name] AS machine_name,
                [machine].[description] AS machine_description,
                [rom].[name], [rom].[size], [rom].[sha1], [rom].[crc]
            FROM
                [machine]
                INNER JOIN [rom] ON [machine].machine_id = [rom].machine_id
            WHERE [rom].[@NAME] = @VALUE;
        `));
        tasks.push(databaseSearch('HBMAME Software ROM', application, 1, `
            SELECT
                softwarelist.[name] AS softwarelist_name,
                softwarelist.[description] AS softwarelist_description,
                software.[name] AS software_name,
                software.[description] AS software_description,
                [rom].[name], [rom].[size], [rom].[sha1], [rom].[crc]
            FROM
                softwarelist
                INNER JOIN software ON softwarelist.softwarelist_id = software.softwarelist_id
                INNER JOIN part ON software.software_id = part.software_id
                INNER JOIN dataarea ON part.part_id = dataarea.part_id
                INNER JOIN rom ON dataarea.dataarea_id = rom.dataarea_id
            WHERE
                [rom].[@NAME] = @VALUE;
        `));

        if (name === 'name')
            tasks.push(databaseSearch('HBMAME Machine', application, 0, `
                SELECT
                    machine_search_payload.[name] AS [machine_name],
                    machine_search_payload.[description] AS [machine_description],
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        machine_search_payload,
                        ([name], [description]),
                        @VALUE
                    ) AS search_result
                JOIN machine_search_payload AS machine_search_payload
                    ON machine_search_payload.[name] = search_result.[KEY]
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));


        if (name === 'name')
            tasks.push(databaseSearch('HBMAME Software', application, 1, `
                SELECT
                    software_search_payload.[softwarelist_name],
                    software_search_payload.[software_name],
                    software_search_payload.[description] AS [software_description],
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        software_search_payload,
                        ([software_name], [description]),
                        @VALUE
                    ) AS search_result
                JOIN software_search_payload AS software_search_payload
                    ON software_search_payload.[key] = search_result.[KEY]
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));
    }

    if (application = applicationServers['fbneo']) {

        if (name !== 'sha1')
            tasks.push(databaseSearch('FBNeo Game ROM', application, 0, `
                SELECT
                    datafile.[key] AS datafile_name,
                    game.name AS game_name,
                    game.description AS game_description,
                    [rom].[name], [rom].[size], '' AS [sha1], [rom].[crc]
                FROM
                    datafile
                    INNER JOIN game ON datafile.datafile_id = game.datafile_id
                    INNER JOIN rom ON game.game_id = rom.game_id
                WHERE
                    [rom].[@NAME] = @VALUE;
            `));

        if (name === 'name')
            tasks.push(databaseSearch('FBNeo Game', application, 0, `
                SELECT
                    datafile.[key] AS datafile_name,
                    game.[name] AS [game_name],
                    game.[description] AS [game_description],
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        game,
                        ([name], [description]),
                        @VALUE
                    ) AS search_result
                JOIN game
                    ON game.[game_id] = search_result.[KEY]
                JOIN datafile
                    ON datafile.datafile_id = game.datafile_id
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));
    }

    if (application = applicationServers['tosec']) {
        
        tasks.push(databaseSearch('TOSEC Game ROM/DISK', application, 0, `
            SELECT
                LOWER(datafile.category) AS tosec_category,
                datafile.name AS tosec_datafile_name,
                game.name AS tosec_game_name,
                [rom].[name], [rom].[size], [rom].[sha1], [rom].[crc]
            FROM
                datafile
                INNER JOIN game ON datafile.datafile_id = game.datafile_id
                INNER JOIN rom ON game.game_id = rom.game_id
            WHERE
                [rom].[@NAME] = @VALUE;
        `));

        if (name === 'name')
            tasks.push(databaseSearch('TOSEC Game', application, 0, `
                SELECT
                    LOWER(datafile.category) AS tosec_category,
                    datafile.name AS tosec_datafile_name,
                    game.[name] AS tosec_game_name,
                    search_result.[RANK] AS [rank]
                FROM FREETEXTTABLE(
                        game,
                        ([name]),
                        @VALUE
                    ) AS search_result
                JOIN game AS game
                    ON game.[game_id] = search_result.[KEY]
                JOIN datafile
                    ON datafile.datafile_id = game.datafile_id
                WHERE search_result.[RANK] > 100
                ORDER BY search_result.[RANK] DESC;
            `));
    }

    return (await Promise.all(tasks)).join(os.EOL);
}
