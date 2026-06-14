import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([Auction]), ConfigModule],
  controllers: [AuctionsController],
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}
