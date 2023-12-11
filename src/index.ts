import { Connection, ConnectOptions, Document as IDocument, Model, Schema, createConnection } from 'mongoose';
import { TsukiError, TsukiTypeError, BaseDatabase, merge, transformObject } from './Base';
import chalk from 'chalk';
import 'dotenv/config';

interface Document extends IDocument {
    _id: string;
    data: any;
}

const DocumentSchema = new Schema<Document>({
    _id: { type: String, default: null, required: true },
    data: { type: Schema.Types.Mixed, default: {}, required: false }
});

interface Options extends ConnectOptions {
    returnErrors?: boolean;
    autoConnect?: boolean;
    warnReady?: boolean;
    url: string;
}

export class Database extends BaseDatabase {
    private model: Model<Document>;
    public connection: Connection;
    
    constructor(options: Options) {
        super();
        
        super.on('error', (message: string, error: TsukiError | TsukiTypeError) => {
            const DefaultError = error instanceof TsukiError ? TsukiError : TsukiTypeError;
            
            if(options.returnErrors !== false) {
                console.log(new DefaultError(message));
            }
            
            return new DefaultError(message);
        });
        
        super.once('ready', async() => {
            if(options.warnReady !== false) {
                const color = chalk.hex('#89b4fa');
                console.log(`[${color('TSUKI, MONGODB')}]: The database is connected - Ping: ${await this.ping()}`);
                return true;
            }
        });
        
        if(typeof options !== 'object' || options === null) throw new TsukiTypeError('[ ❌ ] › The "options" parameter was not provided or is invalid.');
        if(options?.autoConnect !== false) this.connect(options);
    }
    
    public async ping() {
        const initial = Date.now();
        await this.model.findOne();
        return Date.now() - initial;
    }
    
    public async get(key: string, name = 'DEFAULT') {
        this._check();
        
        if(!key) return this._emitTypeError('[ ❌ ] › The "key" parameter was not provided.');
        const doc = await this.model.findById(name);
        if(!doc) return this._emitTypeError(`[ ❌ ] › The document ${name} does not exist.`);
        
        let data = doc.data || {};
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        
        if(key === '.') return data;
        const keys = key.split('.');
        
        for(const k of keys) {
            data = data?.[k];
        }
        
        return data;
    }
    
    public async fetch(key: string, name = 'DEFAULT') {
        return await this.get(key, name);
    }
    
    public async set(key: string, value: any, name = 'DEFAULT') {
        this._check();
    
        if(!key) return this._emitTypeError('[ ❌ ] › The "key" parameter was not provided.');
        const doc = await this.model.findById(name);
        if(!doc) return this._emitTypeError(`[ ❌ ] › The document ${name} does not exist.`);
        
        const keys = key.replaceAll('/', '.').replaceAll(':', '.');
        doc.data[`${keys}`] = value;
        
        return doc.updateOne({ data: transformObject(doc.data) });
    }
    
    public async update(key: string, value: any, name = 'DEFAULT') {
        this._check();
        
        if(!key) return this._emitTypeError('[ ❌ ] › The "key" parameter was not provided.');
        const doc = await this.model.findById(name);
        if(!doc) return this._emitTypeError(`[ ❌ ] › The document ${name} does not exist.`);
        
        const keys = key.replaceAll('/', '.').replaceAll(':', '.');
        
        let data = { [`${keys}`]: value };
        data = merge(doc.data, transformObject(data));
        
        return doc.updateOne({ data });
    }
    
    public async has(key: string, name = 'DEFAULT') {
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        const keys = key.split('.');
        const lastKey = keys.pop();
        
        const data = await this.get(keys.join('.') || '.', name);
        return Object.hasOwnProperty.call(data || {}, lastKey);
    }
    
    public async delete(key: string, name = 'DEFAULT') {
        const has = await this.has(key, name);
        if (!has) return false;
        
        const doc = await this.model.findById(name);
        
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        const keys = key.split('.');
        
        if(key === '.') return doc.updateOne({ data: {} });
        
        const data = doc.data;
        let updatedDoc = data;
        
        const lastKey = keys.pop();
        
        for (const k of keys) {
            updatedDoc = updatedDoc[k];
        }
        
        delete updatedDoc[lastKey];
        await doc.updateOne({ data });
        return (await this.has(key, name)) ? false : true;
    }
    
    public async push(key: string, value: any, name = 'DEFAULT') {
        const has = await this.has(key, name);
        const val = await this.get(key, name) || [];
        
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        if (has && !Array.isArray(val)) this._emitTypeError(`[ ❌ ] › The path "${key}" is not a Array.`);
        
        val.push(value);
        return this.set(key, val, name);
    }
    
    public async pull(key: string, value: any, name = 'DEFAULT') {
        const has = await this.has(key, name);
        const val = await this.get(key, name) || [];
        
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        if (has && !Array.isArray(val)) this._emitTypeError(`[ ❌ ] › The path "${key}" is not a Array.`);
        
        const index = val.findIndex((item) => item === value);
        if(index === -1) return false;
        
        val.splice(index, 1);
        return this.set(key, val, name);
    }
    
    public async add(key: string, value: number, name = 'DEFAULT') {
        if(typeof value !== 'number') value = Number(value);
        const has = await this.has(key, name);
        let val = Number(await this.get(key, name)) || 0;
        
        if(!value || isNaN(value)) this._emitTypeError('[ ❌ ] › The "value" parameter is not a Number.');
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        if (has && isNaN(val)) this._emitTypeError(`[ ❌ ] › The path "${key}" is not a Number.`);
        
        val += value;
        return this.set(key, val, name);
    }
    
    public async sub(key: string, value: number, name = 'DEFAULT') {
        if(typeof value !== 'number') value = Number(value);
        const has = await this.has(key, name);
        let val = Number(await this.get(key, name)) || 0;
        
        if(!value || isNaN(value)) this._emitTypeError('[ ❌ ] › The "value" parameter is not a Number.');
        key = key.replaceAll('/', '.').replaceAll(':', '.');
        if (has && isNaN(val)) this._emitTypeError(`[ ❌ ] › The path "${key}" is not a Number.`);
        
        val -= value;
        return this.set(key, val, name);
    }
    
    public async connect(options: Options) {
        if(this.connection) return this.connection;
        if(typeof options.url !== 'string') throw new TsukiError('[ ❌ ] › The database link provided is invalid.');
        
        try {
            const url = options.url;
            
            for(const key in options) {
                if(['url', 'autoConnect', 'returnErrors', 'warnReady'].includes(key)) delete options[key];
            }
            
            const connection = createConnection(url, options as ConnectOptions);
            this.connection = connection;
            
            this.model = connection.model('DATABASE', DocumentSchema);
            
            await this.createDocument();
            await super.emit('ready');
            return connection;
        } catch(error) {
            throw `[ ❌ ] › Error when trying to connect to the database:\n${error instanceof Error ? error.stack : error}`;
        }
    }
    
    async createDocument(name = 'DEFAULT') {
        let doc = await this.model.findById(name);
        if(doc) return doc;
        
        doc = await this.model.create({ _id: name });
        return doc;
    }
    
    private _check() {
        if(!this.connection) throw new TsukiTypeError('[ ❌ ] › The database is not connected.');
    }
    
    /*private _emitError(message: string) {
        return super.emit('error', message, TsukiError);
    }*/
    
    private _emitTypeError(message: string) {
        return super.emit('error', message, TsukiTypeError);
    }
}