import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CATEGORIES } from 'src/lib/categories';
import type { CategoryId } from 'src/lib/categories';

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  startingPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  buyoutPrice?: number;

  @IsIn(CATEGORY_IDS)
  category: CategoryId;
}
