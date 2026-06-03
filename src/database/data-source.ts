import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from 'src/users/entities/user.entity';
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, RefreshToken],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: true,
});
