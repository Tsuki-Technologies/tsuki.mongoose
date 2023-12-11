import EventEmitter from 'node:events';

export class TsukiError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class TsukiTypeError extends TypeError {
    constructor(message: string) {
        super(message);
    }
}

export class BaseDatabase extends EventEmitter {
    constructor() {
        super({ captureRejections: true });
    }
}

export function merge(target: Record<string, any>, source: Record<string, any>) {
    for (const key in source) {
        if(typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            if(!(key in target)) {
                target[key] = {};
            } else {
                target[key] = merge(target[key], source[key]);
            }
        } else {
            target[key] = source[key];
        }
    }

    return target;
}

export function transformObject(target: Record<string, any>) {
    const resultObject = {};
    
    for (const key in target) {
        if(!key.includes('.')) {
            resultObject[key] = target[key];
        } else {
            const parts = key.split('.');
            let currentObj = resultObject;
            
            for (let i = 0; i < parts.length - 1; i++) {
                currentObj[parts[i]] = currentObj[parts[i]] || {};
                currentObj = currentObj[parts[i]];
            }
            
            currentObj[parts[parts.length - 1]] = target[key];
        }
    }
    
    return resultObject;
}