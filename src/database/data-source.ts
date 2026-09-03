import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from 'src/users/entities/user.entity';
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';
import { Auction } from 'src/auctions/entities/auction.entity';
import { Bid } from 'src/bids/bid.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, RefreshToken, Auction, Bid],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: true,
});
