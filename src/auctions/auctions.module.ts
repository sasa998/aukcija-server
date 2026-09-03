import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Auction } from './entities/auction.entity';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionGateway } from './auction.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auction]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionGateway],
  exports: [AuctionsService, AuctionGateway],
})
export class AuctionsModule {}
