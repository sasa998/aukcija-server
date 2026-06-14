import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueTokenHash1781382726283 implements MigrationInterface {
    name = 'AddUniqueTokenHash1781382726283'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auctions" DROP CONSTRAINT "FK_auctions_seller_id"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash")`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD CONSTRAINT "FK_0cc14a58a02d6cf816e906d2c6b" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auctions" DROP CONSTRAINT "FK_0cc14a58a02d6cf816e906d2c6b"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1"`);
        await queryRunner.query(`ALTER TABLE "auctions" ADD CONSTRAINT "FK_auctions_seller_id" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
