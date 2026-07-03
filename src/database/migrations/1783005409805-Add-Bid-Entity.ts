import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBidEntity1783005409805 implements MigrationInterface {
    name = 'AddBidEntity1783005409805'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auctions" ADD "current_bidder_id" uuid`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD "minBidIncrement" numeric(10,2) NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD "bidCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD CONSTRAINT "FK_47b8a3410fea524bf093f886a6c" FOREIGN KEY ("current_bidder_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auctions" DROP CONSTRAINT "FK_47b8a3410fea524bf093f886a6c"`);
        await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "bidCount"`);
        await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "minBidIncrement"`);
        await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "current_bidder_id"`);
    }

}
