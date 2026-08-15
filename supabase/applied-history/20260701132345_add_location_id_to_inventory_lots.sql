ALTER TABLE "inventory_lots" ADD COLUMN "location_id" uuid REFERENCES "locations"("id");

CREATE INDEX "idx_inventory_lots_location" ON "inventory_lots"("location_id");