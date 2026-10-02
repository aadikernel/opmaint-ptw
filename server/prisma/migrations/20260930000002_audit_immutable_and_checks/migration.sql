-- Audit log is append-only: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows are immutable (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Data integrity: a permit window must end after it starts.
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_window_check"
CHECK ("plannedStart" IS NULL OR "plannedEnd" IS NULL OR "plannedEnd" > "plannedStart");
