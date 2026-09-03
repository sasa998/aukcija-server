import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusAndCategoryToAuction1782943205423 implements MigrationInterface {
    name = 'AddStatusAndCategoryToAuction1782943205423'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."auctions_status_enum" AS ENUM('ACTIVE', 'ENDED', 'CANCELLED', 'NO_SALE')`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD "status" "public"."auctions_status_enum" NOT NULL DEFAULT 'ACTIVE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."auctions_status_enum"`);
    }

}
