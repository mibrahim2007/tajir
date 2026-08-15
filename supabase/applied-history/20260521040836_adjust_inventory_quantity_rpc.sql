
CREATE OR REPLACE FUNCTION adjust_inventory_quantity(p_lot_id UUID, p_delta NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE inventory_lots
  SET current_quantity = current_quantity + p_delta
  WHERE id = p_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC) TO service_role;
