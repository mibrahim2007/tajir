# Tajir — User Training Guide

**Version:** May 2026 | **Roles:** Owner · Assistant

---

## Table of Contents

1. [Roles & Access](#1-roles--access)
2. [Dashboard](#2-dashboard)
3. [Inventory](#3-inventory)
4. [Purchases](#4-purchases)
5. [Sales](#5-sales)
6. [Suppliers & Payables](#6-suppliers--payables)
7. [Customers & Receivables](#7-customers--receivables)
8. [Pricing Rules](#8-pricing-rules)
9. [Reports](#9-reports)
10. [Audit Trail](#10-audit-trail)
11. [Settings](#11-settings)
12. [Key Business Workflows](#12-key-business-workflows)

---

## 1. Roles & Access

| Feature | Owner | Assistant |
|---------|:-----:|:---------:|
| View Inventory / Purchases / Sales | ✓ | ✓ |
| Create Purchase / Sale | ✓ | ✓ |
| Edit / Delete any record | ✓ | — |
| Suppliers / Customers / Pricing | ✓ | — |
| Reports / Audit Trail | ✓ | — |
| Settings (Team, Opening Balances) | ✓ | — |
| Override oversell on stock | ✓ | — |

---

## 2. Dashboard

The dashboard is the home screen after login. It shows your business name, your role, and a grid of quick-action tiles.

- **Owner** sees: Inventory, New Purchase, New Sale, Reports, and more.
- **Assistant** sees: Inventory, New Purchase, New Sale only.

---

## 3. Inventory

### 3.1 Stock Item List

Displays all stock items in a paginated table (50 per page).

| Column | Description |
|--------|-------------|
| Name | Full name of the stock item |
| Code | Short reference code (optional) |
| Count | Textile count, e.g. "30s" |
| Type | Combed or Carded |
| Fiber | Material composition, e.g. "Cotton" |
| Lot | Lot/batch number |
| Qty | Current quantity in stock |

**Filters** — Use the filter bar to narrow results by Count, Type, Fiber, or Lot. Filters are preserved across pages.

**Actions** (Owner only): Add Stock Item · Edit (✏) · Delete (🗑)

---

### 3.2 Add Stock Item

Click **Add Stock Item** to open the form.

| Field | Required | Notes |
|-------|:--------:|-------|
| Name | ✓ | e.g. "Super Fine 30s Combed" |
| Code | | e.g. "SF30C" |
| Count | ✓ | e.g. "30s" |
| Type | | Combed or Carded |
| Fiber | | e.g. "Cotton, Polyester" |
| Lot | | e.g. "L-2024-001" |

> **Duplicate Lot Warning:** If the lot number you entered already exists on another item, a confirmation dialog appears. You can proceed to create a second item with the same lot, or cancel and enter a different lot number.

---

### 3.3 Edit Stock Item

Click the ✏ icon on any row to edit Name, Code, Count, Type, Fiber, or Lot. Stock quantity cannot be changed here — it is updated automatically by purchases and sales.

---

### 3.4 Delete Stock Item

Click the 🗑 icon and confirm. This permanently removes the item. Only possible if no purchases or sales are linked to it.

---

## 4. Purchases

### 4.1 Purchase List

Shows all purchase orders, newest first.

| Column | Description |
|--------|-------------|
| Date | Purchase date (DD MMM YYYY) |
| Supplier | Supplier name |
| Item | Stock item purchased |
| Qty | Units purchased |
| Rate | Rate per unit (with currency) |
| PKR Total | Full cost in Pakistani Rupees |

**Actions** (Owner only): Edit (✏) · Delete (🗑)

> **On Delete:** The stock quantity is automatically reversed (reduced back).

---

### 4.2 New Purchase

Navigate to **Purchases → New Purchase**.

| Field | Required | Notes |
|-------|:--------:|-------|
| Supplier | ✓ | Searchable dropdown — type to filter |
| Stock Item | ✓ | Searchable dropdown — shows count in brackets |
| Quantity | ✓ | Decimals allowed (e.g. 50.500) |
| Rate per Unit | ✓ | Enter amount, select PKR or USD |
| Exchange Rate | ✓ if USD | How many PKR = 1 USD, must be > 1 |
| Advance Paid | | PKR amount paid upfront (reduces payable) |
| Date | ✓ | Defaults to today |

Click **Confirm Purchase**. The stock quantity increases immediately. Click **Cancel** to return without saving.

> **If no suppliers or stock items exist**, the submit button is disabled with a message directing you to add them first.

---

## 5. Sales

### 5.1 Sales List

Shows all sale orders, newest first.

| Column | Description |
|--------|-------------|
| Date | Sale date |
| Customer | Customer name |
| Item | Stock item sold |
| Qty | Units sold |
| Rate | Rate per unit (with currency) |
| Amount | PKR equivalent |
| Due Date | Payment due date (shown in red if overdue) |

**Actions** (Owner only): Edit · Delete

> **On Delete:** The stock quantity is automatically restored.

---

### 5.2 New Sale

Navigate to **Sales → New Sale**.

| Field | Required | Notes |
|-------|:--------:|-------|
| Customer | ✓ | Searchable dropdown |
| Stock Item | ✓ | Searchable — shows available quantity |
| Quantity | ✓ | Decimals allowed |
| Rate (per unit) | ✓ | Auto-filled if a pricing rule exists (see §8) |
| Currency / Exchange Rate | | PKR or USD; exchange rate required for USD |
| Sale Date | ✓ | Defaults to today |
| Payment Due Date | | Optional; shown in red in the list when overdue |

Click **Confirm Sale**. Click **Cancel** to go back.

**Auto-populate Rate:** When you select a customer and stock item, the system checks for a saved pricing rule. If one exists, the Rate field fills automatically. You can still override it manually.

**Oversell Check:**
- The form shows the available quantity below the Stock Item dropdown.
- If your quantity exceeds what is available:
  - **Owner:** A dialog appears showing the shortfall. You can choose **Override & Confirm Sale** (stock will go negative) or **Cancel**.
  - **Assistant:** A dialog appears but there is no override option. Reduce the quantity or ask the owner.

---

## 6. Suppliers & Payables

### 6.1 Supplier List

Shows each supplier with their current outstanding balance (how much you owe them).

> **Outstanding = Opening Balance + Total Purchases − Advances Paid − Total Payments**

Balances shown in **red** when positive (money owed). Click **Ledger** to see the full transaction history.

**Actions** (Owner only): Add Supplier · Edit name · Delete

> **On Delete:** Supplier and all associated transactions are removed.

---

### 6.2 Add Supplier

| Field | Required | Notes |
|-------|:--------:|-------|
| Name | ✓ | Company or person name |
| Opening Balance | | Historical amount owed before system start; supports PKR or USD |

---

### 6.3 Supplier Ledger

The ledger is a running statement for a single supplier.

**Header:** Supplier name · Outstanding Balance (red if > 0)

**Table columns:**

| Column | Description |
|--------|-------------|
| Date | Transaction date |
| Description | Opening balance / Purchase details / Payment details |
| Debit | What you owe (opening balance, purchases net of advance) |
| Credit | Payments made |
| Balance | Running total owed |

**Actions:**
- **Record Payment** — opens a form to log a payment to this supplier
- **Export** — downloads the ledger as Excel
- Edit / Delete individual payments (Owner only)
- Delete a purchase from the ledger (Owner only — stock is reversed)

---

### 6.4 Record Supplier Payment

| Field | Required | Notes |
|-------|:--------:|-------|
| Amount | ✓ | PKR or USD |
| Date | ✓ | Defaults to today |
| Note | | e.g. "Bank transfer", "Cheque #123" |

---

## 7. Customers & Receivables

### 7.1 Customer List

Shows each customer with their outstanding balance (how much they owe you).

> **Outstanding = Opening Balance + Total Sales − Total Receipts**

Click **Ledger** for the full statement.

**Actions** (Owner only): Add Customer · Edit name · Delete

> **On Delete:** Customer and **all associated sales and receipts** are permanently deleted.

---

### 7.2 Add Customer

| Field | Required | Notes |
|-------|:--------:|-------|
| Name | ✓ | |
| Opening Balance | | Historical receivable before system start; PKR or USD |

---

### 7.3 Customer Ledger

Same structure as the Supplier Ledger but from the receivables perspective.

| Column | Description |
|--------|-------------|
| Date | Transaction date |
| Description | Opening balance / Sale details / Receipt details |
| Debit | What customer owes (opening balance, sales) |
| Credit | Receipts received |
| Balance | Running amount owed by customer |

**Actions:**
- **Record Receipt** — logs a payment received from this customer
- **Export** — downloads ledger as Excel
- Edit / Delete receipts (Owner only)
- Delete a sale from the ledger (Owner only — stock is restored)

---

### 7.4 Record Customer Receipt

| Field | Required | Notes |
|-------|:--------:|-------|
| Amount | ✓ | PKR or USD |
| Date | ✓ | Defaults to today |
| Note | | e.g. "Online transfer", "Cash" |

---

## 8. Pricing Rules

Pricing rules store customer-specific rates so they auto-fill when creating a sale.

### 8.1 Pricing List

Shows all active pricing rules with customer, item, rate (PKR), and effective date.

**Actions** (Owner only): Set Price · View History · Delete

> **On Delete:** The customer reverts to manual rate entry on the next sale.

---

### 8.2 Set a Pricing Rule

| Field | Required | Notes |
|-------|:--------:|-------|
| Customer | ✓ | Searchable dropdown |
| Stock Item | ✓ | Searchable dropdown |
| Rate (PKR) | ✓ | Price per unit |
| Effective From | ✓ | Date the price takes effect |

Once saved, the next time you create a sale for this customer + item combination, the Rate field auto-fills with this value. You can still edit it per sale.

**Pricing History:** Click **History** on any rule row to see previous rates for that customer–item pair.

---

## 9. Reports

All reports are accessible from **Reports** in the navigation (Owner only).

---

### 9.1 Purchase & Sales Report

**Path:** Reports → Purchase & Sales

A date-range transaction report combining purchases and sales.

**Filters:**
- **From / To:** Date range (defaults to the current calendar month)
- **Type:** All · Purchases only · Sales only

**Summary cards:**
- Total Purchases (PKR)
- Total Sales (PKR)
- Gross Profit = Sales − Purchases (green if positive, red if negative; shown in "All" mode only)

**Table:** Date · Type badge · Party · Item · Qty · Rate · PKR Total

**Buttons:**
- **Print** — opens the browser print dialog; nav and filters are hidden automatically
- **Export Excel** — downloads a formatted `.xlsx` file with totals and gross profit rows

---

### 9.2 Stock Summary Report

**Path:** Reports → Stock Summary

Read-only view of all stock items with current quantities. Identical to the Inventory page but without edit/delete controls.

**Filters:** Count · Type · Fiber · Lot (same as Inventory filters)

**Export Excel** downloads the filtered list.

---

### 9.3 Receivables Aging Report

**Path:** Reports → Receivables Aging

Shows how long customer balances have been outstanding.

| Column | Description |
|--------|-------------|
| Customer | Customer name |
| Total Outstanding | Total owed in PKR |
| 0–30 Days | Amount from invoices aged 0–30 days |
| 31–60 Days | Amount from invoices aged 31–60 days |
| 61–90 Days | Amount from invoices aged 61–90 days |
| 90+ Days | Amount overdue more than 90 days |
| Oldest Invoice | Date of the oldest unpaid invoice |

**How aging is calculated:** Receipts are applied FIFO (oldest invoice paid first). Whatever remains unpaid is bucketed by the original invoice date.

**Export Excel** downloads the full aging table with a grand total row.

---

### 9.4 Payables Aging Report

**Path:** Reports → Payables Aging

Same structure as Receivables Aging but for supplier balances.

- Advances paid on purchases reduce the net amount before aging.
- Payments to suppliers are applied FIFO against outstanding purchase invoices.

---

## 10. Audit Trail

**Path:** Audit (Owner only)

Every change made in the system is logged here — who did it, what changed, and when.

| Column | Description |
|--------|-------------|
| Timestamp | Date and time (Pakistan time) |
| Action | create · update · delete (colour-coded) |
| Entity | Which table was affected |
| Before | Values before the change |
| After | Values after the change |

**Filter by entity** using the button bar at the top (inventory_lots, purchase_orders, sales_orders, etc.).

Paginated at 50 entries per page. Assistants see "Access denied".

---

## 11. Settings

### 11.1 Team

**Path:** Settings → Team (Owner only)

- **Invite Assistant:** Enter an email address to invite a team member with Assistant access.
- **Manage Assistant:** If one exists, you can deactivate or remove them.

> Only one assistant is supported per account.

---

### 11.2 Opening Balances

**Path:** Settings → Opening Balances (Owner only)

Used during initial setup to enter historical data.

**Stock Item Quantities:** Enter the quantity on hand for each stock item as of the start date.

**Customer Opening Balances:** Enter any existing receivable owed by each customer before you started using Tajir.

**Supplier Opening Balances:** Enter any existing payable owed to each supplier before you started using Tajir.

> Changes take effect immediately and flow through all ledgers, aging reports, and outstanding balance calculations.

---

## 12. Key Business Workflows

### Workflow A — Initial Setup

1. Go to **Suppliers** → Add all suppliers (with opening balances if they owe you money)
2. Go to **Customers** → Add all customers (with opening balances if they owe you money)
3. Go to **Inventory** → Add all stock items
4. Go to **Settings → Opening Balances** → Enter stock quantities as of the go-live date
5. (Optional) Go to **Pricing** → Set customer-specific rates

---

### Workflow B — Recording a Purchase

1. **Purchases → New Purchase**
2. Select Supplier and Stock Item (type to search)
3. Enter Quantity, Rate, and Date
4. Enter Advance Paid if applicable
5. Click **Confirm Purchase**
6. ✓ Stock quantity increases; supplier balance increases by (Rate × Qty) − Advance Paid

---

### Workflow C — Recording a Sale

1. **Sales → New Sale**
2. Select Customer and Stock Item
3. Check available quantity shown below the Stock Item field
4. Enter Quantity — rate auto-fills from pricing rule if one exists
5. Adjust Rate if needed; set Due Date if applicable
6. Click **Confirm Sale**
7. ✓ Stock decreases; customer balance increases
8. If stock is insufficient: Owner can override; Assistant cannot

---

### Workflow D — Paying a Supplier

1. Go to **Suppliers**, find the supplier, click **Ledger**
2. Click **Record Payment**
3. Enter amount, date, and an optional note
4. ✓ Running balance in the ledger decreases; outstanding on Suppliers list updates

---

### Workflow E — Receiving a Customer Payment

1. Go to **Customers**, find the customer, click **Ledger**
2. Click **Record Receipt**
3. Enter amount, date, and an optional note
4. ✓ Running balance decreases; outstanding on Customers list updates

---

### Workflow F — Running the Monthly Report

1. Go to **Reports → Purchase & Sales**
2. Set **From** to the first day of the month; **To** to the last day
3. Review summary cards: Total Purchases, Total Sales, Gross Profit
4. Use **Type** toggle to drill into Purchases only or Sales only
5. Click **Export Excel** to save or share, or **Print** for a paper copy

---

## Quick Reference — Currency Rules

| Scenario | What to do |
|----------|-----------|
| Transaction in PKR | Select PKR; no exchange rate needed |
| Transaction in USD | Select USD; enter exchange rate (e.g. 278.50 means 1 USD = 278.50 PKR) |
| Exchange rate must be… | Greater than 1 |
| All reports display in… | PKR equivalent |

---

## Quick Reference — Who Can Do What

| Action | Owner | Assistant |
|--------|:-----:|:---------:|
| View inventory, purchases, sales | ✓ | ✓ |
| Create a purchase | ✓ | ✓ |
| Create a sale | ✓ | ✓ |
| Override oversell on stock | ✓ | — |
| Edit / delete any record | ✓ | — |
| Manage suppliers & customers | ✓ | — |
| Set pricing rules | ✓ | — |
| View reports | ✓ | — |
| View audit trail | ✓ | — |
| Invite / remove team members | ✓ | — |
| Set opening balances | ✓ | — |
