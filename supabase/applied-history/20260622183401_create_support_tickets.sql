
CREATE TABLE support_tickets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  user_email  text        NOT NULL,
  tenant_name text        NOT NULL,
  subject     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_email    text        NOT NULL,
  message         text        NOT NULL,
  is_staff_reply  boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_tenant  ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status  ON support_tickets(status);
CREATE INDEX idx_support_tickets_updated ON support_tickets(updated_at DESC);
CREATE INDEX idx_ticket_messages_ticket  ON ticket_messages(ticket_id);
