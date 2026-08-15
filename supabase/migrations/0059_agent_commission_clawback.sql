-- ── Return commission clawback ──────────────────────────────────────
-- Goods that come back did not stay sold, so the commission accrued when they
-- went out has to come off the agent's payable. 0058 already made `amount`
-- signed for exactly this; what it did not allow was a row whose source is a
-- RETURN rather than an invoice.
--
-- GL, riding on the return's own journal entry (the mirror image of the accrual
-- on the invoice's entry, so a clawback can never outlive its return):
--   DR 2150 Agent Commission Payable   (agent_id dim)
--     CR 6500 Commission Expense
--
-- How much comes back depends on how the commission was earned in the first
-- place. The rate is read from the ORIGINAL accrual row, never from the agent's
-- current terms, so a rate changed since the sale cannot restate history:
--   percentage → returned value × the rate stored on the accrual
--   per_unit   → returned quantity × the rate stored on the accrual
--   flat       → nothing on a partial return; the whole fee once the invoice is
--                fully returned. A flat fee is defined by NOT scaling with
--                value, so pro-rating it would contradict the basis the user
--                chose. It is an introduction fee: the broker either introduced
--                a trade that stuck, or one that came back entirely.

-- ── 1. Allow return-sourced rows ────────────────────────────────────
alter table agent_commissions drop constraint if exists agent_commissions_source_type_check;
alter table agent_commissions add constraint agent_commissions_source_type_check
  check (source_type in ('sale_invoice','purchase_invoice','sale_return','purchase_return'));

-- ── 2. Link a clawback back to the invoice it reverses ──────────────
-- Null on an accrual (it IS the invoice); set on a clawback. Without it,
-- capping cumulative clawback at the original accrual would mean walking
-- returns → orders → invoice on every write, which is both slower and easy to
-- get wrong when a return has no linked order.
alter table agent_commissions
  add column if not exists related_invoice_id uuid;
create index if not exists agent_commissions_related_invoice_idx
  on agent_commissions(tenant_id, related_invoice_id);

-- A clawback must name the invoice it reverses; an accrual must not.
alter table agent_commissions drop constraint if exists agent_commissions_related_invoice_check;
alter table agent_commissions add constraint agent_commissions_related_invoice_check
  check (
    (source_type in ('sale_invoice','purchase_invoice') and related_invoice_id is null)
    or
    (source_type in ('sale_return','purchase_return')   and related_invoice_id is not null)
  );

-- ── 3. Sign discipline ──────────────────────────────────────────────
-- An accrual is money owed (positive); a clawback is money un-owed (negative).
-- Enforcing it in the database means the per-agent balance stays a plain
-- sum(amount) everywhere, and a sign slip in application code cannot quietly
-- turn a reversal into a second charge.
alter table agent_commissions drop constraint if exists agent_commissions_amount_sign_check;
alter table agent_commissions add constraint agent_commissions_amount_sign_check
  check (
    (source_type in ('sale_invoice','purchase_invoice') and amount >= 0)
    or
    (source_type in ('sale_return','purchase_return')   and amount <= 0)
  );
