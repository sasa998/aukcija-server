import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { paginate } from 'src/shared/pagination/paginate.util';
import { PaginatedResponse } from 'src/shared/pagination/paginated.response';
import { PaginationDto } from 'src/shared/pagination/pagination.dto';

const AUCTION_DURATION_HOURS = 48;

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepository: Repository<Auction>,
  ) {}

  create(sellerId: string, dto: CreateAuctionDto): Promise<Auction> {
    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + AUCTION_DURATION_HOURS);

    const auction = this.auctionRepository.create({
      ...dto,
      currentPrice: dto.startingPrice,
      buyoutPrice: dto.buyoutPrice ?? null,
      images: dto.images ?? [],
      sellerId,
      endsAt,
    });

    return this.auctionRepository.save(auction);
  }

  findAll(pagination: PaginationDto): Promise<PaginatedResponse<Auction>> {
    return paginate(this.auctionRepository, pagination, {
      relations: { seller: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Auction>> {
    return paginate(this.auctionRepository, pagination, {
      where: { sellerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Auction> {
    const auction = await this.auctionRepository.findOne({
      where: { id },
      relations: { seller: true },
    });

    if (!auction) {
      throw new NotFoundException(`Auction with id ${id} not found`);
    }

    return auction;
  }
}
