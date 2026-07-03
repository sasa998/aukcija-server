import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlaceBidDto } from './dto/place-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BidsService } from './bid.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuctionGateway } from 'src/auctions/auction.gateway';

@Controller('auctions/:auctionId/bids')
export class BidsController {
  constructor(
    private readonly bidsService: BidsService,
    private readonly auctionGateway: AuctionGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async placeBid(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Body() dto: PlaceBidDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.bidsService.placeBid(auctionId, userId, dto);

    this.auctionGateway.emitBidPlaced(auctionId, {
      currentPrice: result.currentPrice,
      currentBidderId: result.currentBidderId,
      bidCount: result.bidCount,
      endsAt: result.endsAt,
    });

    if (result.wasExtended) {
      this.auctionGateway.emitExtended(auctionId, result.endsAt.toISOString());
    }

    if (result.previousBidderId && result.previousBidderId !== userId) {
      this.auctionGateway.emitOutbid(result.previousBidderId, {
        auctionId,
        newPrice: result.currentPrice,
      });
    }

    return result;
  }
}
