-- =========================
--  WMS Enhanced Schema Migration
--  This migration is additive and preserves all existing data
-- =========================

-- =========================
--  ENUMS
-- =========================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_status') THEN
    CREATE TYPE unit_status AS ENUM ('RECEIVED','INSPECTED','REPAIR','READY','SHIPPED','RETURN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbound_type') THEN
    CREATE TYPE outbound_type AS ENUM ('SHIPMENT','SINGLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbound_status') THEN
    CREATE TYPE outbound_status AS ENUM ('CREATED','PICKING','SEALED','DISPATCHED','COMPLETED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_reason') THEN
    CREATE TYPE ledger_reason AS ENUM ('RECEIPT','ADJUST','MOVE','REPAIR','HOLD','RELEASE','OUT');
  END IF;
END $$;

-- =========================
--  REFERENCE / MASTER DATA
-- =========================
CREATE TABLE IF NOT EXISTS product (
  sku               text PRIMARY KEY,
  category          text NOT NULL,     -- Phone/Tablet/Laptop/Watch
  brand             text NOT NULL,
  model             text NOT NULL,
  grade_schema      text DEFAULT 'abc'
);

CREATE TABLE IF NOT EXISTS location (
  id                bigserial PRIMARY KEY,
  site              text NOT NULL,
  zone              text NOT NULL,
  bin               text NOT NULL,
  UNIQUE (site, zone, bin)
);

-- =========================
--  SKU ROLLUP (fast grid)
-- =========================
CREATE TABLE IF NOT EXISTS inventory_item (
  id                bigserial PRIMARY KEY,
  sku               text NOT NULL REFERENCES product(sku),
  site              text NOT NULL,
  on_hand           int  NOT NULL DEFAULT 0,
  ready             int  NOT NULL DEFAULT 0,
  reserved          int  NOT NULL DEFAULT 0,
  qa_hold           int  NOT NULL DEFAULT 0,
  damaged           int  NOT NULL DEFAULT 0,
  available         int  NOT NULL DEFAULT 0,      -- on_hand - reserved - qa_hold - damaged
  avg_cost_cents    int,
  est_value_cents   int,
  first_received_at timestamptz,
  last_movement_at  timestamptz,
  tags_cached       text[] NOT NULL DEFAULT '{}',
  UNIQUE (sku, site)
);

-- =========================
--  PER-UNIT / IMEI
-- =========================
CREATE TABLE IF NOT EXISTS inventory_unit (
  id                   bigserial PRIMARY KEY,
  imei                 text UNIQUE,
  sku                  text NOT NULL REFERENCES product(sku),  -- base SKU
  sku_current          text,                                    -- override-able SKU used for deduction
  site                 text NOT NULL,
  status               unit_status NOT NULL DEFAULT 'RECEIVED',
  location_id          bigint REFERENCES location(id),
  working              text NOT NULL DEFAULT 'PENDING',         -- YES | NO | PENDING
  date_in              date,
  date_last_phonecheck timestamptz,
  admin_cost_cents     int,
  ready_at             timestamptz,
  shipped_at           timestamptz,
  out_at               timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 1–1 detail card for IMEI
CREATE TABLE IF NOT EXISTS imei_detail (
  unit_id                 bigint PRIMARY KEY REFERENCES inventory_unit(id) ON DELETE CASCADE,
  model                   text NOT NULL,
  carrier                 text,
  bh                      text,
  bcc                     text,
  ram                     text,
  tester                  text,
  last_phonecheck_update  timestamptz
);

-- =========================
--  HISTORY / AUDIT
-- =========================
CREATE TABLE IF NOT EXISTS unit_status_history (
  id            bigserial PRIMARY KEY,
  unit_id       bigint NOT NULL REFERENCES inventory_unit(id) ON DELETE CASCADE,
  from_status   unit_status,
  to_status     unit_status NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    text
);

CREATE TABLE IF NOT EXISTS unit_location_history (
  id               bigserial PRIMARY KEY,
  unit_id          bigint NOT NULL REFERENCES inventory_unit(id) ON DELETE CASCADE,
  from_location_id bigint REFERENCES location(id),
  to_location_id   bigint REFERENCES location(id),
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       text
);

-- Optional movement stream
CREATE TABLE IF NOT EXISTS movement (
  id          bigserial PRIMARY KEY,
  unit_id     bigint REFERENCES inventory_unit(id),
  sku         text NOT NULL,
  type        text NOT NULL, -- receipt|move|repair|ship|adjust|return
  qty         int NOT NULL DEFAULT 1,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);

-- Phonecheck runs
CREATE TABLE IF NOT EXISTS phonecheck_log (
  id          bigserial PRIMARY KEY,
  unit_id     bigint REFERENCES inventory_unit(id) ON DELETE CASCADE,
  run_at      timestamptz NOT NULL DEFAULT now(),
  result      jsonb
);

-- =========================
--  TAGGING
-- =========================
CREATE TABLE IF NOT EXISTS tag (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  namespace  text NOT NULL DEFAULT 'user',  -- system|user|client
  value_type text NOT NULL DEFAULT 'flag',  -- flag|text|int|enum
  is_active  boolean NOT NULL DEFAULT true,
  UNIQUE (namespace, name)
);

CREATE TABLE IF NOT EXISTS entity_tag (
  entity_type  text NOT NULL,  -- 'unit' | 'item' | 'sku'
  entity_id    bigint NOT NULL,
  tag_id       bigint NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  tag_value    text,
  valid_from   timestamptz NOT NULL DEFAULT now(),
  valid_to     timestamptz,
  added_by     text,
  added_at     timestamptz NOT NULL DEFAULT now(),
  removed_by   text,
  removed_at   timestamptz,
  PRIMARY KEY (entity_type, entity_id, tag_id, valid_from)
);

-- =========================
--  LEDGER (SKU-level stock math)
-- =========================
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id        bigserial PRIMARY KEY,
  ts        timestamptz NOT NULL DEFAULT now(),
  site      text NOT NULL,
  sku       text NOT NULL REFERENCES product(sku),
  qty_delta int  NOT NULL,         -- +1 receipt, -1 out, etc.
  unit_id   bigint REFERENCES inventory_unit(id),
  reason    ledger_reason NOT NULL,
  ref_table text,
  ref_id    bigint,
  note      text
);

-- One-receipt-per-unit guard (optional but recommended)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_ledger_receipt_per_unit'
  ) THEN
    CREATE UNIQUE INDEX uq_ledger_receipt_per_unit
      ON inventory_ledger (unit_id)
      WHERE reason = 'RECEIPT';
  END IF;
END $$;

-- =========================
--  OUTBOUND (SHIPMENT or SINGLE)
-- =========================
CREATE TABLE IF NOT EXISTS outbound (
  id           bigserial PRIMARY KEY,
  type         outbound_type   NOT NULL DEFAULT 'SINGLE',
  site         text            NOT NULL,
  status       outbound_status NOT NULL DEFAULT 'CREATED',
  carrier      text,
  tracking_no  text,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_unit (
  outbound_id  bigint NOT NULL REFERENCES outbound(id) ON DELETE CASCADE,
  unit_id      bigint NOT NULL REFERENCES inventory_unit(id) ON DELETE RESTRICT,
  sku_at_time  text   NOT NULL,
  added_by     text,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (outbound_id, unit_id)
);

-- =========================
--  INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_unit_sku_site        ON inventory_unit (sku, site);
CREATE INDEX IF NOT EXISTS idx_unit_status          ON inventory_unit (status);
CREATE INDEX IF NOT EXISTS idx_unit_location        ON inventory_unit (location_id);
CREATE INDEX IF NOT EXISTS idx_item_site_avail      ON inventory_item (site, available DESC, qa_hold DESC, last_movement_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_skusite_ts    ON inventory_ledger (site, sku, ts);
CREATE INDEX IF NOT EXISTS idx_et_active_by_entity  ON entity_tag (entity_type, entity_id) WHERE valid_to IS NULL;

-- =========================
--  TRIGGERS & FUNCTIONS
-- =========================

-- Default sku_current = base sku
CREATE OR REPLACE FUNCTION set_unit_sku_current()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku_current IS NULL THEN
    NEW.sku_current := NEW.sku;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_unit_sku_current ON inventory_unit;
CREATE TRIGGER trg_set_unit_sku_current
BEFORE INSERT ON inventory_unit
FOR EACH ROW EXECUTE FUNCTION set_unit_sku_current();

-- Status state machine + timestamps
CREATE OR REPLACE FUNCTION enforce_unit_status_transition()
RETURNS TRIGGER AS $$
DECLARE ok boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'RECEIVED' AND NEW.status IN ('INSPECTED','REPAIR') THEN ok := true; END IF;
    IF OLD.status = 'INSPECTED' AND NEW.status IN ('REPAIR','READY')   THEN ok := true; END IF;
    IF OLD.status = 'REPAIR'    AND NEW.status IN ('INSPECTED','READY')THEN ok := true; END IF;
    IF OLD.status = 'READY'     AND NEW.status IN ('SHIPPED','REPAIR') THEN ok := true; END IF;
    IF OLD.status = 'RETURN'    AND NEW.status IN ('INSPECTED','REPAIR','READY') THEN ok := true; END IF;

    IF NOT ok THEN
      RAISE EXCEPTION 'Illegal status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'READY'   AND OLD.status IS DISTINCT FROM 'READY'   THEN NEW.ready_at   := now(); END IF;
    IF NEW.status = 'SHIPPED' AND OLD.status IS DISTINCT FROM 'SHIPPED' THEN NEW.shipped_at := now(); END IF;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_unit_status ON inventory_unit;
CREATE TRIGGER trg_enforce_unit_status
BEFORE UPDATE ON inventory_unit
FOR EACH ROW EXECUTE FUNCTION enforce_unit_status_transition();

-- Roll-up counters refresh from unit states
CREATE OR REPLACE FUNCTION recalc_item_counts(p_sku text, p_site text)
RETURNS void AS $$
DECLARE
  s_on_hand int; s_ready int; s_hold int; s_res int; s_dmg int;
BEGIN
  SELECT
    count(*) FILTER (WHERE status IN ('RECEIVED','INSPECTED','REPAIR','READY')) AS on_hand,
    count(*) FILTER (WHERE status = 'READY')                                     AS ready,
    count(*) FILTER (WHERE status = 'INSPECTED')                                 AS qa_hold,   -- change if QA-hold is a tag
    0                                                                            AS reserved,  -- wire to reservations when used
    count(*) FILTER (WHERE working = 'NO')                                       AS damaged
  INTO s_on_hand, s_ready, s_hold, s_res, s_dmg
  FROM inventory_unit
  WHERE sku = p_sku AND site = p_site;

  UPDATE inventory_item
     SET on_hand  = coalesce(s_on_hand,0),
         ready    = coalesce(s_ready,0),
         qa_hold  = coalesce(s_hold,0),
         reserved = coalesce(s_res,0),
         damaged  = coalesce(s_dmg,0),
         available= greatest(coalesce(s_on_hand,0) - coalesce(s_res,0) - coalesce(s_hold,0) - coalesce(s_dmg,0), 0),
         last_movement_at = now()
   WHERE sku = p_sku AND site = p_site;

  IF NOT FOUND THEN
    INSERT INTO inventory_item (sku, site, on_hand, ready, qa_hold, reserved, damaged, available, first_received_at, last_movement_at)
    VALUES (p_sku, p_site, coalesce(s_on_hand,0), coalesce(s_ready,0), coalesce(s_hold,0), coalesce(s_res,0),
            coalesce(s_dmg,0),
            greatest(coalesce(s_on_hand,0) - coalesce(s_res,0) - coalesce(s_hold,0) - coalesce(s_dmg,0), 0),
            now(), now());
  END IF;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_unit_mutation_recalc()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalc_item_counts(NEW.sku, NEW.site);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unit_mutation_recalc ON inventory_unit;
CREATE TRIGGER trg_unit_mutation_recalc
AFTER INSERT OR UPDATE OF status, site, working ON inventory_unit
FOR EACH ROW EXECUTE FUNCTION on_unit_mutation_recalc();

-- Apply ledger deltas to SKU/site rollup (on_hand & available)
CREATE OR REPLACE FUNCTION ledger_apply_to_item()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory_item (sku, site, on_hand, available, last_movement_at)
  VALUES (NEW.sku, NEW.site, NEW.qty_delta, NEW.qty_delta, NEW.ts)
  ON CONFLICT (sku, site) DO UPDATE
  SET on_hand   = inventory_item.on_hand   + NEW.qty_delta,
      available = greatest(inventory_item.available + NEW.qty_delta, 0),
      last_movement_at = NEW.ts;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_apply ON inventory_ledger;
CREATE TRIGGER trg_ledger_apply
AFTER INSERT ON inventory_ledger
FOR EACH ROW EXECUTE FUNCTION ledger_apply_to_item();

-- =========================
--  CORE PROCEDURE: SCAN-OUT (IMEI → SKU deduction; for SINGLE or SHIPMENT)
-- =========================
CREATE OR REPLACE FUNCTION scan_out(
  p_imei         text,
  p_outbound_id  bigint DEFAULT NULL,
  p_user         text   DEFAULT NULL,
  p_sku_override text   DEFAULT NULL,         -- optional override per unit
  p_reason       ledger_reason DEFAULT 'OUT'
)
RETURNS TABLE (
  outbound_id bigint,
  unit_id     bigint,
  sku_used    text,
  site        text,
  status_from unit_status,
  status_to   unit_status,
  ts          timestamptz
) AS $$
DECLARE
  v_unit inventory_unit%ROWTYPE;
  v_out_id bigint;
  v_sku text;
BEGIN
  -- Lock unit row
  SELECT * INTO v_unit
  FROM inventory_unit
  WHERE imei = p_imei
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMEI % not found', p_imei;
  END IF;

  IF v_unit.status <> 'READY' THEN
    RAISE EXCEPTION 'IMEI % not eligible to OUT (status=%)', p_imei, v_unit.status;
  END IF;

  -- Make/attach outbound
  IF p_outbound_id IS NULL THEN
    INSERT INTO outbound(type, site, status, created_by)
    VALUES ('SINGLE', v_unit.site, 'CREATED', p_user)
    RETURNING id INTO v_out_id;
  ELSE
    v_out_id := p_outbound_id;
  END IF;

  -- SKU used for deduction
  v_sku := coalesce(p_sku_override, v_unit.sku_current, v_unit.sku);

  -- Link unit to outbound (idempotent)
  INSERT INTO outbound_unit(outbound_id, unit_id, sku_at_time, added_by)
  VALUES (v_out_id, v_unit.id, v_sku, p_user)
  ON CONFLICT DO NOTHING;

  -- Ledger: -1 at SKU/site
  INSERT INTO inventory_ledger (site, sku, qty_delta, unit_id, reason, ref_table, ref_id, note)
  VALUES (v_unit.site, v_sku, -1, v_unit.id, p_reason, 'outbound', v_out_id, p_imei);

  -- Movement (optional)
  INSERT INTO movement (unit_id, sku, type, qty, note, created_by)
  VALUES (v_unit.id, v_sku, 'ship', 1, concat('outbound#', v_out_id), p_user);

  -- State change (guarded)
  UPDATE inventory_unit
     SET status = 'SHIPPED',
         out_at = now(),
         sku_current = v_sku,
         updated_at = now()
   WHERE id = v_unit.id;

  -- Refresh rollups from per-unit states
  PERFORM recalc_item_counts(v_sku, v_unit.site);

  RETURN QUERY
  SELECT v_out_id, v_unit.id, v_sku, v_unit.site, v_unit.status, 'SHIPPED'::unit_status, now();
END $$ LANGUAGE plpgsql;

-- =========================
--  MIGRATION COMPLETE
-- =========================
COMMENT ON SCHEMA public IS 'WMS Enhanced Schema - Migration 001 Applied';
