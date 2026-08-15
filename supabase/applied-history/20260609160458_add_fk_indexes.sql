
-- tajir_journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_tjel_journal_entry_id ON public.tajir_journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_tjel_account_id ON public.tajir_journal_entry_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_tjel_tenant_id ON public.tajir_journal_entry_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tjel_customer_id ON public.tajir_journal_entry_lines (customer_id);
CREATE INDEX IF NOT EXISTS idx_tjel_supplier_id ON public.tajir_journal_entry_lines (supplier_id);
CREATE INDEX IF NOT EXISTS idx_tjel_stock_item_id ON public.tajir_journal_entry_lines (stock_item_id);

-- sale_returns
CREATE INDEX IF NOT EXISTS idx_sale_returns_tenant_id ON public.sale_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer_id ON public.sale_returns (customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_order_id ON public.sale_returns (sale_order_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_stock_item_id ON public.sale_returns (stock_item_id);

-- purchase_returns
CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant_id ON public.purchase_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON public.purchase_returns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_order_id ON public.purchase_returns (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_stock_item_id ON public.purchase_returns (stock_item_id);

-- gatepasses (tenant_id already covered by idx_gatepasses_tenant_date composite,
--             but we add the dedicated FK indexes per action list)
CREATE INDEX IF NOT EXISTS idx_gatepasses_purchase_order_id ON public.gatepasses (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_gatepasses_sales_order_id ON public.gatepasses (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_gatepasses_tenant_id ON public.gatepasses (tenant_id);

-- purchase_orders, sales_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_stock_item_id ON public.purchase_orders (stock_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_stock_item_id ON public.sales_orders (stock_item_id);

-- inventory_lots
CREATE INDEX IF NOT EXISTS idx_inventory_lots_default_supplier_id ON public.inventory_lots (default_supplier_id);

-- tenant_counters (tenant_id is part of composite PK — already indexed, IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_tenant_counters_tenant_id ON public.tenant_counters (tenant_id);

-- tenant_users
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users (user_id);
