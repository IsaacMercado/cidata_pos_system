import { addRxPlugin, createRxDatabase, RxDatabase, RxJsonSchema } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import { replicateRxCollection } from 'rxdb/plugins/replication';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
addRxPlugin(RxDBLeaderElectionPlugin);

let dbPromise: Promise<RxDatabase> | null = null;

const exchangeRateSchema: RxJsonSchema<any> = {
  title: 'exchange rate schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    currencyFrom: { type: 'text', default: 'USD' },
    currencyTo: { type: 'text', default: 'VES' },
    rate: { type: 'number', default: 0 },
    fetchedAt: { type: 'text', format: 'date-time', readOnly: true },
  },
  required: ['currencyFrom', 'currencyTo', 'rate'],
};

const categorySchema: RxJsonSchema<any> = {
  title: 'category schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    name: { type: 'string' },
    description: { type: 'string' },
    parentId: { type: 'integer', ref: "categories" },
    isActive: { type: 'integer', default: 1 },
    createdAt: { type: 'string', readOnly: true },
  },
  required: ['name'],
};

const productSchema: RxJsonSchema<any> = {
  title: 'product schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    code: { type: 'string' },
    name: { type: 'string' },
    price: { type: 'number', default: 0 },
    cost: { type: 'number', default: 0 },
    taxRate: { type: 'number', default: 0 },
    currentStock: { type: 'number', default: 0 },
    isActive: { type: 'integer', default: 1 },
  },
  required: ['code', 'name'],
};

const userSchema: RxJsonSchema<any> = {
  title: 'user schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    username: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'cashier' },
    isSuperuser: { type: 'integer', default: 0 },
    pinHash: { type: 'string' },
  },
  required: ['username', 'name'],
};

const schemas = {
  exchange_rates: exchangeRateSchema,
  categories: categorySchema,
  products: productSchema,
  users: userSchema,
};

export async function getDatabase(): Promise<RxDatabase> {
  if (!dbPromise) {
    if (import.meta.env.DEV) {
      addRxPlugin(RxDBDevModePlugin);
    }
    const storage = wrappedValidateAjvStorage(getRxStorageDexie());
    dbPromise = createRxDatabase({
      name: 'pos_offline',
      storage,
      multiInstance: true,
      eventReduce: true,
    }).then(async (db) => {
      await db.addCollections(schemas);
      return db;
    });
  }
  return dbPromise;
}
