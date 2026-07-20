export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ap_payment_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          payment_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          payment_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          payment_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payment_lines_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ap_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payments: {
        Row: {
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          currency_code: string
          date: string
          id: string
          payment_method_note: string | null
          pkr_equivalent: number
          serial_number: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          currency_code?: string
          date: string
          id?: string
          payment_method_note?: string | null
          pkr_equivalent: number
          serial_number?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          currency_code?: string
          date?: string
          id?: string
          payment_method_note?: string | null
          pkr_equivalent?: number
          serial_number?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_receipt_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          receipt_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          receipt_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          receipt_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_receipt_lines_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "ar_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipt_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_receipts: {
        Row: {
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          currency_code: string
          customer_id: string
          date: string
          id: string
          payment_method_note: string | null
          pkr_equivalent: number
          serial_number: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          currency_code?: string
          customer_id: string
          date: string
          id?: string
          payment_method_note?: string | null
          pkr_equivalent: number
          serial_number?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          currency_code?: string
          customer_id?: string
          date?: string
          id?: string
          payment_method_note?: string | null
          pkr_equivalent?: number
          serial_number?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_receipts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entry_id: string
          filename: string
          id: string
          org_id: string
          size: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          filename: string
          id?: string
          org_id: string
          size: number
          storage_path: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          filename?: string
          id?: string
          org_id?: string
          size?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          org_id: string
          payload: Json
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          org_id: string
          payload?: Json
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          account_number: string | null
          branch: string | null
          created_at: string
          id: string
          name: string
          opening_balance: number
          tenant_id: string
        }
        Insert: {
          account_number?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          tenant_id: string
        }
        Update: {
          account_number?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_header: boolean
          is_system: boolean
          name: string
          parent_code: string | null
          system_key: string | null
          tenant_id: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_header?: boolean
          is_system?: boolean
          name: string
          parent_code?: string | null
          system_key?: string | null
          tenant_id: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_header?: boolean
          is_system?: boolean
          name?: string
          parent_code?: string | null
          system_key?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          customer_id: string
          date: string
          exchange_rate: number
          id: string
          pkr_equivalent: number
          reason: string | null
          reference: string | null
          sale_order_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          customer_id: string
          date: string
          exchange_rate?: number
          id?: string
          pkr_equivalent: number
          reason?: string | null
          reference?: string | null
          sale_order_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          customer_id?: string
          date?: string
          exchange_rate?: number
          id?: string
          pkr_equivalent?: number
          reason?: string | null
          reference?: string | null
          sale_order_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_sale_order_id_fkey"
            columns: ["sale_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_price_lists: {
        Row: {
          created_at: string
          customer_id: string
          effective_from: string
          id: string
          is_active: boolean
          rate: number
          stock_item_id: string
          superseded_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          effective_from?: string
          id?: string
          is_active?: boolean
          rate: number
          stock_item_id: string
          superseded_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          rate?: number
          stock_item_id?: string
          superseded_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_price_lists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_price_lists_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_price_lists_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "customer_price_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_refund_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          refund_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          refund_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          refund_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_refund_lines_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "customer_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_refunds: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          customer_id: string
          date: string
          exchange_rate: number
          id: string
          notes: string | null
          payment_method: string | null
          pkr_equivalent: number
          serial_number: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          customer_id: string
          date: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          pkr_equivalent: number
          serial_number?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          customer_id?: string
          date?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          pkr_equivalent?: number
          serial_number?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_refunds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          date: string
          exchange_rate: number
          id: string
          pkr_equivalent: number
          purchase_order_id: string | null
          reason: string | null
          reference: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          date: string
          exchange_rate?: number
          id?: string
          pkr_equivalent: number
          purchase_order_id?: string | null
          reason?: string | null
          reference?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          date?: string
          exchange_rate?: number
          id?: string
          pkr_equivalent?: number
          purchase_order_id?: string | null
          reason?: string | null
          reference?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_serials: {
        Row: {
          doc_type: string
          last_number: number
          tenant_id: string
          year: number
        }
        Insert: {
          doc_type: string
          last_number?: number
          tenant_id: string
          year: number
        }
        Update: {
          doc_type?: string
          last_number?: number
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_serials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          currency_code: string
          disbursement_date: string
          employee_id: string
          exchange_rate: number
          first_due_date: string | null
          frequency: string
          id: string
          installment_amount: number | null
          installment_count: number | null
          notes: string | null
          pkr_equivalent: number
          principal: number
          serial_number: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          disbursement_date: string
          employee_id: string
          exchange_rate?: number
          first_due_date?: string | null
          frequency?: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          notes?: string | null
          pkr_equivalent: number
          principal: number
          serial_number?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          disbursement_date?: string
          employee_id?: string
          exchange_rate?: number
          first_due_date?: string | null
          frequency?: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          notes?: string | null
          pkr_equivalent?: number
          principal?: number
          serial_number?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          cnic: string | null
          created_at: string
          designation: string | null
          employee_code: string | null
          id: string
          is_active: boolean
          monthly_salary: number
          name: string
          phone: string | null
          tenant_id: string
        }
        Insert: {
          cnic?: string | null
          created_at?: string
          designation?: string | null
          employee_code?: string | null
          id?: string
          is_active?: boolean
          monthly_salary?: number
          name: string
          phone?: string | null
          tenant_id: string
        }
        Update: {
          cnic?: string | null
          created_at?: string
          designation?: string | null
          employee_code?: string | null
          id?: string
          is_active?: boolean
          monthly_salary?: number
          name?: string
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      gatepass_items: {
        Row: {
          created_at: string
          entry_date: string | null
          gatepass_id: string
          id: string
          purchase_order_id: string | null
          quantity: number | null
          sales_order_id: string | null
          stock_item_id: string | null
        }
        Insert: {
          created_at?: string
          entry_date?: string | null
          gatepass_id: string
          id?: string
          purchase_order_id?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          stock_item_id?: string | null
        }
        Update: {
          created_at?: string
          entry_date?: string | null
          gatepass_id?: string
          id?: string
          purchase_order_id?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gatepass_items_gatepass_id_fkey"
            columns: ["gatepass_id"]
            isOneToOne: false
            referencedRelation: "gatepasses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gatepass_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gatepass_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      gatepasses: {
        Row: {
          created_at: string
          date: string
          driver_name: string | null
          gatepass_number: string
          id: string
          remarks: string | null
          tenant_id: string
          type: string
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string
          date: string
          driver_name?: string | null
          gatepass_number: string
          id?: string
          remarks?: string | null
          tenant_id: string
          type: string
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          driver_name?: string | null
          gatepass_number?: string
          id?: string
          remarks?: string | null
          tenant_id?: string
          type?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gatepasses_tenant_id_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          code: string | null
          count: number | null
          created_at: string
          current_quantity: number
          default_supplier_id: string | null
          fiber: string | null
          id: string
          item_nature: string
          item_type_id: string | null
          location_id: string | null
          lot: string | null
          name: string
          opening_rate: number
          sku: string
          tenant_id: string
          type: string | null
          unit_of_measure: string | null
        }
        Insert: {
          code?: string | null
          count?: number | null
          created_at?: string
          current_quantity?: number
          default_supplier_id?: string | null
          fiber?: string | null
          id?: string
          item_nature?: string
          item_type_id?: string | null
          location_id?: string | null
          lot?: string | null
          name: string
          opening_rate?: number
          sku?: string
          tenant_id: string
          type?: string | null
          unit_of_measure?: string | null
        }
        Update: {
          code?: string | null
          count?: number | null
          created_at?: string
          current_quantity?: number
          default_supplier_id?: string | null
          fiber?: string | null
          id?: string
          item_nature?: string
          item_type_id?: string | null
          location_id?: string | null
          lot?: string | null
          name?: string
          opening_rate?: number
          sku?: string
          tenant_id?: string
          type?: string | null
          unit_of_measure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_lots_supplier"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "inventory_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: string | null
          amount: number
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string
          customer_id: string | null
          due_date: string
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by: string
          customer_id?: string | null
          due_date: string
          id?: string
          issue_date: string
          journal_entry_id?: string | null
          notes?: string | null
          number: string
          org_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string
          customer_id?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          notes?: string | null
          number?: string
          org_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      item_types: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_types_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          org_id: string
          reference: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          org_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          org_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_disbursement_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          loan_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          loan_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          loan_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_disbursement_lines_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_disbursement_lines_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_disbursement_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_no: number
          loan_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_no: number
          loan_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_no?: number
          loan_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayment_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          repayment_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          repayment_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          repayment_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayment_lines_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_lines_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          date: string
          employee_id: string
          exchange_rate: number
          id: string
          loan_id: string | null
          payment_method_note: string | null
          pkr_equivalent: number
          serial_number: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          date: string
          employee_id: string
          exchange_rate?: number
          id?: string
          loan_id?: string | null
          payment_method_note?: string | null
          pkr_equivalent: number
          serial_number?: string | null
          source?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          date?: string
          employee_id?: string
          exchange_rate?: number
          id?: string
          loan_id?: string | null
          payment_method_note?: string | null
          pkr_equivalent?: number
          serial_number?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          currency: string
          fiscal_year_start: number
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fiscal_year_start?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fiscal_year_start?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_transaction_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          tenant_id: string
          transaction_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          tenant_id: string
          transaction_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          tenant_id?: string
          transaction_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_transaction_lines_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_transaction_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "owner_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_transactions: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          date: string
          exchange_rate: number
          id: string
          notes: string | null
          owner_id: string
          pkr_equivalent: number
          serial_number: string | null
          tenant_id: string
          txn_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          date: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          owner_id: string
          pkr_equivalent: number
          serial_number?: string | null
          tenant_id: string
          txn_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          date?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          owner_id?: string
          pkr_equivalent?: number
          serial_number?: string | null
          tenant_id?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          cnic: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          profit_share_pct: number
          tenant_id: string
        }
        Insert: {
          cnic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          profit_share_pct?: number
          tenant_id: string
        }
        Update: {
          cnic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          profit_share_pct?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_locks: {
        Row: {
          locked_through: string
          note: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          locked_through: string
          note?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          locked_through?: string
          note?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_locks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_allocation_lines: {
        Row: {
          allocation_id: string
          amount: number
          created_at: string
          id: string
          owner_id: string
          share_pct: number
          tenant_id: string
        }
        Insert: {
          allocation_id: string
          amount: number
          created_at?: string
          id?: string
          owner_id: string
          share_pct: number
          tenant_id: string
        }
        Update: {
          allocation_id?: string
          amount?: number
          created_at?: string
          id?: string
          owner_id?: string
          share_pct?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_allocation_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "profit_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_allocation_lines_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_allocation_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_allocations: {
        Row: {
          created_at: string
          id: string
          net_profit: number
          notes: string | null
          period_end: string
          period_start: string
          reversed_at: string | null
          serial_number: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          net_profit: number
          notes?: string | null
          period_end: string
          period_start: string
          reversed_at?: string | null
          serial_number?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          net_profit?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          reversed_at?: string | null
          serial_number?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      party_links: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          supplier_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          journal_entry_id: string | null
          notes: string | null
          org_id: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          journal_entry_id?: string | null
          notes?: string | null
          org_id: string
          payment_date: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          journal_entry_id?: string | null
          notes?: string | null
          org_id?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          advance_paid: number
          confirmed_at: string | null
          created_at: string
          currency_code: string
          date: string
          exchange_rate: number
          id: string
          invoice_id: string | null
          location_id: string | null
          multiply_by: number
          nos_carton: number | null
          payment_due_date: string | null
          pkr_equivalent: number
          qty_lbs: number | null
          quantity: number
          rate: number
          serial_number: string | null
          stock_item_id: string
          supplier_id: string
          supplier_invoice_no: string | null
          tenant_id: string
          weight_per_carton: number | null
          yarn_type: string | null
          yarn_weight: number | null
        }
        Insert: {
          advance_paid?: number
          confirmed_at?: string | null
          created_at?: string
          currency_code: string
          date: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          location_id?: string | null
          multiply_by?: number
          nos_carton?: number | null
          payment_due_date?: string | null
          pkr_equivalent: number
          qty_lbs?: number | null
          quantity: number
          rate: number
          serial_number?: string | null
          stock_item_id: string
          supplier_id: string
          supplier_invoice_no?: string | null
          tenant_id: string
          weight_per_carton?: number | null
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Update: {
          advance_paid?: number
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          date?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          location_id?: string | null
          multiply_by?: number
          nos_carton?: number | null
          payment_due_date?: string | null
          pkr_equivalent?: number
          qty_lbs?: number | null
          quantity?: number
          rate?: number
          serial_number?: string | null
          stock_item_id?: string
          supplier_id?: string
          supplier_invoice_no?: string | null
          tenant_id?: string
          weight_per_carton?: number | null
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          currency_code: string
          date: string
          exchange_rate: number
          id: string
          location_id: string | null
          multiply_by: number
          pkr_equivalent: number
          purchase_order_id: string | null
          quantity: number
          rate: number
          reason: string | null
          serial_number: string | null
          stock_item_id: string
          supplier_id: string
          tenant_id: string
          yarn_type: string | null
          yarn_weight: number | null
        }
        Insert: {
          created_at?: string
          currency_code?: string
          date: string
          exchange_rate?: number
          id?: string
          location_id?: string | null
          multiply_by?: number
          pkr_equivalent: number
          purchase_order_id?: string | null
          quantity: number
          rate: number
          reason?: string | null
          serial_number?: string | null
          stock_item_id: string
          supplier_id: string
          tenant_id: string
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Update: {
          created_at?: string
          currency_code?: string
          date?: string
          exchange_rate?: number
          id?: string
          location_id?: string | null
          multiply_by?: number
          pkr_equivalent?: number
          purchase_order_id?: string | null
          quantity?: number
          rate?: number
          reason?: string | null
          serial_number?: string | null
          stock_item_id?: string
          supplier_id?: string
          tenant_id?: string
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "purchase_returns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          currency_code: string
          customer_id: string
          date: string
          exchange_rate: number
          id: string
          location_id: string | null
          multiply_by: number
          pkr_equivalent: number
          quantity: number
          rate: number
          reason: string | null
          sale_order_id: string | null
          serial_number: string | null
          stock_item_id: string
          tenant_id: string
          yarn_type: string | null
          yarn_weight: number | null
        }
        Insert: {
          created_at?: string
          currency_code?: string
          customer_id: string
          date: string
          exchange_rate?: number
          id?: string
          location_id?: string | null
          multiply_by?: number
          pkr_equivalent: number
          quantity: number
          rate: number
          reason?: string | null
          sale_order_id?: string | null
          serial_number?: string | null
          stock_item_id: string
          tenant_id: string
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Update: {
          created_at?: string
          currency_code?: string
          customer_id?: string
          date?: string
          exchange_rate?: number
          id?: string
          location_id?: string | null
          multiply_by?: number
          pkr_equivalent?: number
          quantity?: number
          rate?: number
          reason?: string | null
          sale_order_id?: string | null
          serial_number?: string | null
          stock_item_id?: string
          tenant_id?: string
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "sale_returns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_sale_order_id_fkey"
            columns: ["sale_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sale_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          confirmed_at: string | null
          created_at: string
          currency_code: string
          customer_id: string
          date: string
          dc_no: string | null
          due_days: number | null
          exchange_rate: number
          id: string
          invoice_id: string | null
          location_id: string | null
          multiply_by: number
          nos_carton: number | null
          notes: string | null
          payment_due_date: string | null
          pkr_equivalent: number
          po_no: string | null
          qty_lbs: number | null
          quantity: number
          rate: number
          serial_number: string | null
          stock_item_id: string
          tenant_id: string
          weight_per_carton: number | null
          yarn_type: string | null
          yarn_weight: number | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          currency_code: string
          customer_id: string
          date: string
          dc_no?: string | null
          due_days?: number | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          location_id?: string | null
          multiply_by?: number
          nos_carton?: number | null
          notes?: string | null
          payment_due_date?: string | null
          pkr_equivalent: number
          po_no?: string | null
          qty_lbs?: number | null
          quantity: number
          rate: number
          serial_number?: string | null
          stock_item_id: string
          tenant_id: string
          weight_per_carton?: number | null
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_id?: string
          date?: string
          dc_no?: string | null
          due_days?: number | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          location_id?: string | null
          multiply_by?: number
          nos_carton?: number | null
          notes?: string | null
          payment_due_date?: string | null
          pkr_equivalent?: number
          po_no?: string | null
          qty_lbs?: number | null
          quantity?: number
          rate?: number
          serial_number?: string | null
          stock_item_id?: string
          tenant_id?: string
          weight_per_carton?: number | null
          yarn_type?: string | null
          yarn_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "sales_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          date: string
          from_location_id: string
          id: string
          notes: string | null
          quantity: number
          stock_item_id: string
          tenant_id: string
          to_location_id: string
        }
        Insert: {
          created_at?: string
          date: string
          from_location_id: string
          id?: string
          notes?: string | null
          quantity: number
          stock_item_id: string
          tenant_id: string
          to_location_id: string
        }
        Update: {
          created_at?: string
          date?: string
          from_location_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          stock_item_id?: string
          tenant_id?: string
          to_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          org_id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_refund_lines: {
        Row: {
          cheque_due_date: string | null
          pdc_status: string
          settled_at: string | null
          settled_bank_id: string | null
          amount: number
          bank_id: string | null
          cheque_number: string | null
          created_at: string
          id: string
          line_no: number
          refund_id: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          refund_id: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          cheque_due_date?: string | null
          pdc_status?: string
          settled_at?: string | null
          settled_bank_id?: string | null
          amount?: number
          bank_id?: string | null
          cheque_number?: string | null
          created_at?: string
          id?: string
          line_no?: number
          refund_id?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_refund_lines_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "supplier_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_refunds: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          date: string
          exchange_rate: number
          id: string
          notes: string | null
          payment_method: string | null
          pkr_equivalent: number
          serial_number: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: string
          date: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          pkr_equivalent: number
          serial_number?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          date?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          pkr_equivalent?: number
          serial_number?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_refunds_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          opening_balance: number
          opening_balance_currency: string
          opening_balance_pkr_equivalent: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          opening_balance_currency?: string
          opening_balance_pkr_equivalent?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          opening_balance_currency?: string
          opening_balance_pkr_equivalent?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          closed_reviewed: boolean
          created_at: string
          id: string
          status: string
          subject: string
          tenant_id: string
          tenant_name: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          closed_reviewed?: boolean
          created_at?: string
          id?: string
          status?: string
          subject: string
          tenant_id: string
          tenant_name: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          closed_reviewed?: boolean
          created_at?: string
          id?: string
          status?: string
          subject?: string
          tenant_id?: string
          tenant_name?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tajir_attachments: {
        Row: {
          created_at: string
          entity_type: string
          entry_id: string
          filename: string
          id: string
          size: number
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          entry_id: string
          filename: string
          id?: string
          size: number
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          entry_id?: string
          filename?: string
          id?: string
          size?: number
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tajir_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tajir_customers: {
        Row: {
          created_at: string
          id: string
          name: string
          opening_balance: number
          opening_balance_currency: string
          opening_balance_pkr_equivalent: number
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          opening_balance_currency?: string
          opening_balance_pkr_equivalent?: number
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          opening_balance_currency?: string
          opening_balance_pkr_equivalent?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tajir_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tajir_journal_entries: {
        Row: {
          bank_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          reference: string | null
          source_id: string | null
          source_type: string
          tenant_id: string
          voucher_number: string
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          reference?: string | null
          source_id?: string | null
          source_type?: string
          tenant_id: string
          voucher_number: string
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          reference?: string | null
          source_id?: string | null
          source_type?: string
          tenant_id?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "tajir_journal_entries_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tajir_journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          customer_id: string | null
          debit: number
          description: string | null
          employee_id: string | null
          id: string
          journal_entry_id: string
          owner_id: string | null
          stock_item_id: string | null
          supplier_id: string | null
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          employee_id?: string | null
          id?: string
          journal_entry_id: string
          owner_id?: string | null
          stock_item_id?: string | null
          supplier_id?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          employee_id?: string | null
          id?: string
          journal_entry_id?: string
          owner_id?: string | null
          stock_item_id?: string | null
          supplier_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tajir_journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "tajir_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "tajir_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "location_stock_summary"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajir_journal_entry_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_counters: {
        Row: {
          counter_name: string
          current_value: number
          tenant_id: string
        }
        Insert: {
          counter_name: string
          current_value?: number
          tenant_id: string
        }
        Update: {
          counter_name?: string
          current_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          permissions: Json | null
          role: string
          tenant_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json | null
          role: string
          tenant_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json | null
          role?: string
          tenant_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          locked_at: string | null
          name: string
          ntn: string | null
          subscription_expires_at: string | null
          subscription_status: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          locked_at?: string | null
          name: string
          ntn?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          locked_at?: string | null
          name?: string
          ntn?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_staff_reply: boolean
          message: string
          sender_email: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message: string
          sender_email: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message?: string
          sender_email?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pdc_register: {
        Row: {
          amount: number | null
          bank_id: string | null
          cheque_due_date: string | null
          cheque_number: string | null
          counter_key: string | null
          direction: string | null
          doc_date: string | null
          doc_serial: string | null
          document_id: string | null
          line_id: string | null
          party_id: string | null
          party_kind: string | null
          party_name: string | null
          pdc_status: string | null
          settled_at: string | null
          source: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      ap_aging: {
        Row: {
          aging_bucket: string | null
          amount_paid: number | null
          balance_due: number | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          issue_date: string | null
          number: string | null
          org_id: string | null
          total: number | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_aging: {
        Row: {
          aging_bucket: string | null
          amount_paid: number | null
          balance_due: number | null
          customer_name: string | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          issue_date: string | null
          number: string | null
          org_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_stock_summary: {
        Row: {
          location_id: string | null
          location_name: string | null
          quantity: number | null
          stock_item_id: string | null
          stock_item_name: string | null
          tenant_id: string | null
          yarn_count: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_inventory_quantity: {
        Args: { p_delta: number; p_lot_id: string }
        Returns: undefined
      }
      get_account_balance: {
        Args: { p_as_of?: string; p_org_id: string }
        Returns: {
          account_id: string
          balance: number
          code: string
          credit_total: number
          debit_total: number
          name: string
          type: Database["public"]["Enums"]["account_type"]
        }[]
      }
      get_next_voucher_number: {
        Args: { p_prefix?: string; p_tenant_id: string }
        Returns: string
      }
      is_org_member: { Args: { org_uuid: string }; Returns: boolean }
      is_org_member_with_role: {
        Args: {
          org_uuid: string
          required_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      next_document_serial: {
        Args: { p_date: string; p_doc_type: string; p_tenant_id: string }
        Returns: string
      }
      seed_standard_coa: { Args: { p_tenant_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
      entry_status: "DRAFT" | "PENDING_APPROVAL" | "POSTED" | "VOID"
      invoice_status: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID"
      invoice_type: "RECEIVABLE" | "PAYABLE"
      payment_method:
        | "BANK_TRANSFER"
        | "CHEQUE"
        | "CASH"
        | "CREDIT_CARD"
        | "OTHER"
      plan_tier: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
      subscription_status:
        | "TRIAL"
        | "ACTIVE"
        | "PAST_DUE"
        | "SUSPENDED"
        | "CANCELLED"
        | "DELETED"
      user_role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER" | "AUDITOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
      entry_status: ["DRAFT", "PENDING_APPROVAL", "POSTED", "VOID"],
      invoice_status: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "VOID"],
      invoice_type: ["RECEIVABLE", "PAYABLE"],
      payment_method: [
        "BANK_TRANSFER",
        "CHEQUE",
        "CASH",
        "CREDIT_CARD",
        "OTHER",
      ],
      plan_tier: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
      subscription_status: [
        "TRIAL",
        "ACTIVE",
        "PAST_DUE",
        "SUSPENDED",
        "CANCELLED",
        "DELETED",
      ],
      user_role: ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER", "AUDITOR"],
    },
  },
} as const
