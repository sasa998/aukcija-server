// src/bids/bids.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Bid, BidStatus } from './bid.entity';
import { DataSource } from 'typeorm';
import { PlaceBidDto } from './dto/place-bid.dto';
import { Auction, AuctionStatus } from 'src/auctions/entities/auction.entity';

export interface PlaceBidResult {
  auctionId: string;
  currentPrice: number;
  currentBidderId: string;
  previousBidderId: string | null;
  bidCount: number;
  endsAt: Date;
  wasExtended: boolean;
}

const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000; // extend if bid lands within last 2 min
const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000; // extend by 2 min

@Injectable()
export class BidsService {
  constructor(private readonly dataSource: DataSource) {}

  async placeBid(
    auctionId: string,
    bidderId: string,
    dto: PlaceBidDto,
  ): Promise<PlaceBidResult> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the auction row for the duration of this transaction.
      // Any concurrent bid on the SAME auction has to wait right here.
      const auction = await manager
        .createQueryBuilder(Auction, 'auction')
        .setLock('pessimistic_write')
        .where('auction.id = :auctionId', { auctionId })
        .getOne();

      if (!auction) {
        throw new NotFoundException('Aukcija nije pronađena');
      }

      if (auction.status !== AuctionStatus.ACTIVE) {
        throw new BadRequestException('Aukcija nije aktivna');
      }

      if (auction.endsAt <= new Date()) {
        throw new BadRequestException('Aukcija je već završena');
      }

      console.log('sellerId:', auction.sellerId, 'bidderId:', bidderId);

      if (auction.sellerId === bidderId) {
        throw new BadRequestException(
          'Ne možete licitirati na sopstvenu aukciju',
        );
      }

      if (auction.currentBidderId === bidderId) {
        throw new BadRequestException('Već ste najviši ponuđač');
      }

      const minAcceptable =
        Number(auction.currentPrice) + Number(auction.minBidIncrement);

      if (dto.amount < minAcceptable) {
        throw new ConflictException({
          message: `Ponuda mora biti najmanje ${minAcceptable}`,
          currentPrice: auction.currentPrice,
          minAcceptable,
        });
      }

      // Anti-snipe check
      const now = Date.now();
      const msRemaining = auction.endsAt.getTime() - now;
      let wasExtended = false;

      if (msRemaining < ANTI_SNIPE_WINDOW_MS) {
        auction.endsAt = new Date(now + ANTI_SNIPE_EXTENSION_MS);
        wasExtended = true;
      }

      const outbidBidderId: string | null = auction.currentBidderId ?? null;

      auction.currentPrice = dto.amount;
      auction.currentBidderId = bidderId;
      auction.bidCount += 1;

      await manager.save(Auction, auction);

      // Mark the previous winning bid as outbid, insert the new one
      await manager.update(
        Bid,
        { auctionId, status: BidStatus.WINNING },
        { status: BidStatus.OUTBID },
      );

      const bid = manager.create(Bid, {
        auctionId,
        bidderId,
        amount: dto.amount,
        status: BidStatus.WINNING,
      });
      await manager.save(Bid, bid);

      return {
        auctionId: auction.id,
        currentPrice: auction.currentPrice,
        currentBidderId: auction.currentBidderId,
        previousBidderId: outbidBidderId,
        bidCount: auction.bidCount,
        endsAt: auction.endsAt,
        wasExtended,
      };
    });
  }
}
