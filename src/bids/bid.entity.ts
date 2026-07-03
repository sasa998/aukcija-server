import { Auction } from 'src/auctions/entities/auction.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum BidStatus {
  WINNING = 'WINNING',
  OUTBID = 'OUTBID',
}

@Entity('bids')
@Index(['auction', 'createdAt'])
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Auction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auction_id' })
  auction: Auction;

  @Column({ name: 'auction_id' })
  auctionId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bidder_id' })
  bidder: User;

  @Column({ name: 'bidder_id' })
  bidderId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: BidStatus, default: BidStatus.WINNING })
  status: BidStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
