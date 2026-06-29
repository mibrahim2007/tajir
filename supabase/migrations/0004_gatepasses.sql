CREATE TABLE "gatepasses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"purchase_order_id" uuid,
	"sales_order_id" uuid,
	"entry_date" date NOT NULL,
	"date" date NOT NULL,
	"vehicle_number" text NOT NULL,
	"driver_name" text NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_gatepasses_type" CHECK ("type" IN ('purchase', 'sale')),
	CONSTRAINT "chk_gatepasses_order_ref" CHECK (
		("type" = 'purchase' AND "purchase_order_id" IS NOT NULL AND "sales_order_id" IS NULL) OR
		("type" = 'sale' AND "sales_order_id" IS NOT NULL AND "purchase_order_id" IS NULL)
	)
);
--> statement-breakpoint
ALTER TABLE "gatepasses" ADD CONSTRAINT "gatepasses_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "gatepasses" ADD CONSTRAINT "gatepasses_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id");
--> statement-breakpoint
ALTER TABLE "gatepasses" ADD CONSTRAINT "gatepasses_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id");
--> statement-breakpoint
CREATE INDEX "idx_gatepasses_tenant_date" ON "gatepasses" ("tenant_id", "date" DESC);
