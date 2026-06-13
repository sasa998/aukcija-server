import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuctions1749654321000 implements MigrationInterface {
  name = 'CreateAuctions1749654321000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auctions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "starting_price" numeric(12,2) NOT NULL,
        "buyout_price" numeric(12,2),
        "current_price" numeric(12,2) NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "images" jsonb NOT NULL DEFAULT '[]',
        "seller_id" uuid NOT NULL,
        CONSTRAINT "PK_auctions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "auctions"
        ADD CONSTRAINT "FK_auctions_seller_id"
        FOREIGN KEY ("seller_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP CONSTRAINT "FK_auctions_seller_id"`,
    );
    await queryRunner.query(`DROP TABLE "auctions"`);
  }
}
