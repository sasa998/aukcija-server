import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ClassSerializerInterceptor,
  UseInterceptors,
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PaginationDto } from 'src/shared/pagination/pagination.dto';
import { multerConfig } from 'src/image-upload/upload';
import { FilesInterceptor } from '@nestjs/platform-express';

interface AuthenticatedRequest extends ExpressRequest {
  user: Pick<JwtPayload, 'sub'> & { id: string; email: string };
}

@UseInterceptors(ClassSerializerInterceptor)
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('images', 5, multerConfig))
  create(
    @Request() req: AuthenticatedRequest,
    @Body() createAuctionDto: CreateAuctionDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.auctionsService.create(
      req.user.id,
      createAuctionDto,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMy(
    @Request() req: AuthenticatedRequest,
    @Query() pagination: PaginationDto,
  ) {
    return this.auctionsService.findByUser(req.user.id, pagination);
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.auctionsService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionsService.findOne(id);
  }
}
