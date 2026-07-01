import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryToAuctions1781900000000 implements MigrationInterface {
  name = 'AddCategoryToAuctions1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auctions"
        ADD COLUMN IF NOT EXISTS "category" character varying(50) NOT NULL DEFAULT 'other'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auctions" DROP COLUMN "category"
    `);
  }
}
