import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { CategoryId } from 'src/lib/categories';

enum AuctionStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
  NO_SALE = 'NO_SALE',
}

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'starting_price', type: 'numeric', precision: 12, scale: 2 })
  startingPrice: number;

  @Column({
    name: 'buyout_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  buyoutPrice: number | null;

  @Column({ name: 'current_price', type: 'numeric', precision: 12, scale: 2 })
  currentPrice: number;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'images', type: 'jsonb', default: '[]' })
  images: string[];

  @Column({
    name: 'status',
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.ACTIVE,
  })
  status: AuctionStatus;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @Column({ name: 'category', type: 'varchar', length: 50, default: 'other' })
  category: CategoryId;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;
}
