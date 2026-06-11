import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { Client, type ClientConfig } from 'pg';

export default async function globalSetup() {
  const config: ClientConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  };

  const client = new Client(config);

  await client.connect();

  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'aukcija_test'`,
  );

  if ((result.rowCount ?? 0) === 0) {
    await client.query('CREATE DATABASE aukcija_test');
    console.log('Created aukcija_test database');
  }

  await client.end();
}
