import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { paginate } from 'src/shared/pagination/paginate.util';
import { PaginatedResponse } from 'src/shared/pagination/paginated.response';
import { PaginationDto } from 'src/shared/pagination/pagination.dto';
import { ConfigService } from '@nestjs/config';

const AUCTION_DURATION_HOURS = 48;

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepository: Repository<Auction>,
    private readonly configService: ConfigService,
  ) {}

  create(
    sellerId: string,
    dto: CreateAuctionDto,
    files: Express.Multer.File[],
  ): Promise<Auction> {
    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + AUCTION_DURATION_HOURS);

    if (dto.buyoutPrice && dto.buyoutPrice <= dto.startingPrice) {
      throw new BadRequestException(
        'Otkupna cena mora biti veća od početne cene',
      );
    }

    const baseUrl = this.configService.getOrThrow<string>('BASE_URL');
    const images = files.map((file) => `${baseUrl}/uploads/${file.filename}`);

    const auction = this.auctionRepository.create({
      ...dto,
      currentPrice: dto.startingPrice,
      buyoutPrice: dto.buyoutPrice ?? null,
      sellerId,
      endsAt,
      images,
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
      relations: { seller: true },
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
