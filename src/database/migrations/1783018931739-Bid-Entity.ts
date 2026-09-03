import { MigrationInterface, QueryRunner } from "typeorm";

export class BidEntity1783018931739 implements MigrationInterface {
    name = 'BidEntity1783018931739'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bids_status_enum" AS ENUM('WINNING', 'OUTBID')`);
        await queryRunner.query(`CREATE TABLE "bids" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "auction_id" uuid NOT NULL, "bidder_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."bids_status_enum" NOT NULL DEFAULT 'WINNING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7950d066d322aab3a488ac39fe5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9af6e61ded8f4c650310300705" ON "bids"  ("auction_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "bids" ADD CONSTRAINT "FK_7d24f04e55838b694acc9d35bfe" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bids" ADD CONSTRAINT "FK_bc7e4d3d2bdc4c8d9695938d8e4" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bids" DROP CONSTRAINT "FK_bc7e4d3d2bdc4c8d9695938d8e4"`);
        await queryRunner.query(`ALTER TABLE "bids" DROP CONSTRAINT "FK_7d24f04e55838b694acc9d35bfe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9af6e61ded8f4c650310300705"`);
        await queryRunner.query(`DROP TABLE "bids"`);
        await queryRunner.query(`DROP TYPE "public"."bids_status_enum"`);
    }

}
