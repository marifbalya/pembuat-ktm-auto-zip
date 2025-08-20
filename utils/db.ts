
// utils/db.ts

const DB_NAME = 'IDCardGeneratorDB';
const NAMES_STORE_NAME = 'generatedNames';
const TEMPLATE_STORE_NAME = 'templates';
const DB_VERSION = 2;

let db: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Database error:', request.error);
            reject('Error opening database');
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(NAMES_STORE_NAME)) {
                tempDb.createObjectStore(NAMES_STORE_NAME, { keyPath: 'fullName' });
            }
            if (!tempDb.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
                tempDb.createObjectStore(TEMPLATE_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const addNameToDB = async (fullName: string, email: string): Promise<void> => {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([NAMES_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(NAMES_STORE_NAME);
        const request = store.add({
            fullName,
            email,
            timestamp: new Date(),
        });

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error adding name to DB:', request.error);
            reject('Could not add name to DB.');
        };
    });
};

export const nameExistsInDB = async (fullName: string): Promise<boolean> => {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([NAMES_STORE_NAME], 'readonly');
        const store = transaction.objectStore(NAMES_STORE_NAME);
        const request = store.get(fullName);

        request.onsuccess = () => {
            resolve(request.result !== undefined);
        };

        request.onerror = () => {
            console.error('Error checking name in DB:', request.error);
            reject('Could not check name in DB.');
        };
    });
};

const TEMPLATE_KEY = 'user_template';

export const saveTemplate = async (dataUrl: string): Promise<void> => {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([TEMPLATE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(TEMPLATE_STORE_NAME);
        const request = store.put({ id: TEMPLATE_KEY, data: dataUrl });

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error saving template:', request.error);
            reject('Could not save template.');
        };
    });
};

export const getTemplate = async (): Promise<string | null> => {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([TEMPLATE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(TEMPLATE_STORE_NAME);
        const request = store.get(TEMPLATE_KEY);

        request.onsuccess = () => {
            resolve(request.result ? request.result.data : null);
        };
        request.onerror = () => {
            console.error('Error getting template:', request.error);
            reject('Could not get template.');
        };
    });
};

export const removeTemplate = async (): Promise<void> => {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([TEMPLATE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(TEMPLATE_STORE_NAME);
        const request = store.delete(TEMPLATE_KEY);
        
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error removing template:', request.error);
            reject('Could not remove template.');
        };
    });
};

// Initialize the database connection when the module is loaded.
getDB();
