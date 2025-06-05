import fs from 'fs';
import Tedious from 'tedious';

export const directoryFiles = async (directory: string): Promise<string[]> => {
    return fs.readdirSync(directory);
}

export const fileRead = async (filename: string): Promise<string> => {
	const buffer: Buffer = fs.readFileSync(filename);
    return buffer.toString();
}

export const fileReadBuffer = async (filename: string): Promise<Buffer> => {
	const buffer: Buffer = fs.readFileSync(filename);
    return buffer;
}

export const sqlOpen = async (connection: Tedious.Connection): Promise<void> => {
    return new Promise((resolve, reject) => {
        connection.connect((err?: Error) => {
            if (err)
                reject(err);
            else
                resolve();

        });
    });
}

export const sqlClose = async (connection: Tedious.Connection): Promise<void> => {
    return new Promise((resolve, reject) => {
        connection.on('end', () => {
            resolve();
        });
        connection.close();
    });
}

export const sqlRequest = async (connection: Tedious.Connection, request: Tedious.Request): Promise<any[]> => {

    return new Promise((resolve, reject) => {

        request.callback = (error: any, rowCount: any, rows: any) => {

            if (error)
                reject(error);

            resolve(rows);
        };

        connection.execSql(request);
    });
}

export const sqlConfig = (server: string, database: string) => {

    var sqlConfig: any = {  
        server,
        authentication: {
            type: 'default',
            options: {
                userName: 'api',
                password: 'api'
            }
        },
        options: {
            encrypt: false,
            database,
            rowCollectionOnRequestCompletion: true,
            trustServerCertificate: true,
        }
    };

    return sqlConfig;
}
