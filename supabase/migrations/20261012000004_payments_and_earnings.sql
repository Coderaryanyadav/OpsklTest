-- ============================================================================
-- OPSKL PAYMENTS & EARNINGS ENGINE (PHASE 6)
-- Authoritative financial records, Indian payment provider abstraction,
-- organizer billing with GST, worker earnings, idempotent webhooks & audit logs
-- ============================================================================

-- 1. EXTEND PAYMENT RECORDS WITH IDEMPOTENCY & PROVIDER AUDITING
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT;

-- 2. ORGANIZER INVOICES & STATEMENTS
-- Keeps agreed worker wages strictly isolated from platform fees & GST
CREATE TABLE IF NOT EXISTS organizer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE RESTRICT,
  wage_total NUMERIC(10, 2) NOT NULL CHECK (wage_total >= 0),
  platform_fee NUMERIC(10, 2) NOT NULL CHECK (platform_fee >= 0),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(10, 2) NOT NULL CHECK (gst_amount >= 0),
  total_payable NUMERIC(10, 2) NOT NULL CHECK (total_payable >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'escrow_funded', 'settled', 'overdue', 'cancelled')),
  payment_method TEXT DEFAULT 'upi' CHECK (payment_method IN ('upi', 'netbanking', 'neft_rtgs', 'corporate_card', 'sandbox_mock')),
  payment_provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (payment_provider IN ('razorpay', 'cashfree', 'sandbox', 'manual_reconciliation')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_signature TEXT,
  idempotency_key TEXT UNIQUE,
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PAYMENT WEBHOOK EVENTS (Idempotent processing log)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'cashfree', 'sandbox')),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'duplicate')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RECONCILIATION & AUDIT LOGS
CREATE TABLE IF NOT EXISTS payment_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type TEXT NOT NULL CHECK (reconciliation_type IN ('payout', 'invoice_collection', 'refund', 'reversal', 'dispute_hold')),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('matched', 'discrepancy', 'resolved', 'reversed')),
  expected_amount NUMERIC(10, 2) NOT NULL,
  recorded_amount NUMERIC(10, 2) NOT NULL,
  discrepancy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  actor_id UUID REFERENCES profiles(id),
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES FOR HIGH-THROUGHPUT AUDITING
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_organizer_id ON organizer_invoices(organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_job_id ON organizer_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_status ON organizer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id ON payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_ref ON payment_reconciliation_logs(reference_id);

-- 6. ENABLE ROW-LEVEL SECURITY
ALTER TABLE organizer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR INVOICES
CREATE POLICY "Organizers can view their own shift invoices"
  ON organizer_invoices FOR SELECT
  USING (
    organizer_id = auth.uid() OR is_current_admin()
  );

CREATE POLICY "Admins can manage all invoices"
  ON organizer_invoices FOR ALL
  USING (
    is_current_admin()
  );

-- 8. RLS POLICIES FOR WEBHOOK EVENTS & RECONCILIATION
CREATE POLICY "Admins can view and manage webhook events"
  ON payment_webhook_events FOR ALL
  USING (
    is_current_admin()
  );

CREATE POLICY "Admins can view and manage reconciliation logs"
  ON payment_reconciliation_logs FOR ALL
  USING (
    is_current_admin()
  );

CREATE POLICY "Organizers can view own invoice reconciliation logs"
  ON payment_reconciliation_logs FOR SELECT
  USING (
    is_current_admin() OR EXISTS (
      SELECT 1 FROM organizer_invoices
      WHERE organizer_invoices.invoice_number = payment_reconciliation_logs.reference_id
        AND organizer_invoices.organizer_id = auth.uid()
    )
  );

-- 9. RPC: SERVER-SIDE AUTHORITATIVE FINANCIAL CALCULATOR
CREATE OR REPLACE FUNCTION calculate_shift_financials_safe(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_headcount INT;
  v_wage_per_worker NUMERIC(10, 2);
  v_wage_total NUMERIC(10, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_rate NUMERIC(5, 2) := 18.00;
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
BEGIN
  -- Read actual columns defined on the jobs table
  SELECT id, total_pay, hourly_rate, duration_hours, slots_filled, slots_total
  INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Headcount is slots_filled if > 0, else total requested slots (never truncating unstaffed shifts to 1)
  v_headcount := CASE
    WHEN v_job.slots_filled > 0 THEN v_job.slots_filled
    ELSE GREATEST(v_job.slots_total, 1)
  END;

  -- Canonical wage per worker: total_pay or hourly_rate * duration_hours
  v_wage_per_worker := COALESCE(v_job.total_pay, ROUND(v_job.hourly_rate * v_job.duration_hours, 2));
  
  -- 100% of agreed wage belongs strictly to workers
  v_wage_total := ROUND(v_wage_per_worker * v_headcount, 2);
  
  -- Platform service fee is 10% charged to the organizer (never deducted from worker pay)
  v_platform_fee := ROUND(v_wage_total * 0.10, 2);
  
  -- Indian GST (18%) is applied strictly to the platform service fee (Intermediary service)
  v_gst_amount := ROUND(v_platform_fee * (v_gst_rate / 100.0), 2);
  
  -- Total payable by organizer
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'headcount', v_headcount,
    'wage_per_worker', v_wage_per_worker,
    'wage_total', v_wage_total,
    'platform_fee', v_platform_fee,
    'gst_rate', v_gst_rate,
    'gst_amount', v_gst_amount,
    'total_payable', v_total_payable
  );
END;
$$;

-- 10. RPC: GENERATE OR UPDATE AUTHORITATIVE SHIFT INVOICE
CREATE OR REPLACE FUNCTION generate_job_invoice_safe(
  p_job_id UUID,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_calc JSONB;
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_existing_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- 0. Authorization guard & derive organizer identity from job record
  SELECT id, organizer_id INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF auth.uid() IS NULL OR (v_job.organizer_id != auth.uid() AND NOT is_current_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only the job organizer or administrator can generate invoices.');
  END IF;

  -- Authoritative server calculation
  v_calc := calculate_shift_financials_safe(p_job_id);
  IF NOT (v_calc->>'success')::BOOLEAN THEN
    RETURN v_calc;
  END IF;

  -- 7 days before event or 24h from now
  v_due_date := now() + interval '3 days';

  -- Check existing invoice for job
  SELECT id INTO v_existing_id
  FROM organizer_invoices
  WHERE job_id = p_job_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = (v_calc->>'wage_total')::NUMERIC,
      platform_fee = (v_calc->>'platform_fee')::NUMERIC,
      gst_amount = (v_calc->>'gst_amount')::NUMERIC,
      total_payable = (v_calc->>'total_payable')::NUMERIC,
      updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', v_invoice_id,
      'status', 'updated',
      'total_payable', (v_calc->>'total_payable')::NUMERIC
    );
  END IF;

  -- Generate sequential invoice code
  v_invoice_number := 'INV-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');

  INSERT INTO organizer_invoices (
    invoice_number,
    job_id,
    organizer_id,
    wage_total,
    platform_fee,
    gst_rate,
    gst_amount,
    total_payable,
    status,
    payment_method,
    payment_provider,
    due_date,
    is_sandbox
  ) VALUES (
    v_invoice_number,
    p_job_id,
    v_job.organizer_id,
    (v_calc->>'wage_total')::NUMERIC,
    (v_calc->>'platform_fee')::NUMERIC,
    18.00,
    (v_calc->>'gst_amount')::NUMERIC,
    (v_calc->>'total_payable')::NUMERIC,
    'pending',
    'upi',
    'razorpay',
    v_due_date,
    true
  )
  RETURNING id INTO v_invoice_id;

  -- Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, changes)
  VALUES (
    'invoice_generated',
    'organizer_invoices',
    v_invoice_id,
    jsonb_build_object('invoice_number', v_invoice_number, 'total_payable', (v_calc->>'total_payable')::NUMERIC)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'created',
    'total_payable', (v_calc->>'total_payable')::NUMERIC
  );
END;
$$;

-- 11. RPC: IDEMPOTENT WEBHOOK PROCESSOR (WITH RECONCILIATION)
CREATE OR REPLACE FUNCTION process_payment_webhook_safe(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_event RECORD;
  v_record_id UUID;
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_payout RECORD;
BEGIN
  -- 1. Idempotency Check: prevent duplicate event processing
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'event_id', p_event_id,
      'status', v_existing_event.status,
      'message', 'Event already recorded and processed'
    );
  END IF;

  -- 2. Record new webhook event
  INSERT INTO payment_webhook_events (
    provider,
    event_id,
    event_type,
    payload,
    status
  ) VALUES (
    p_provider,
    p_event_id,
    p_event_type,
    p_payload,
    'pending'
  );

  -- 3. Process according to event type
  IF p_event_type IN ('order.paid', 'payment.captured', 'invoice.paid') THEN
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);

    -- Find matching invoice
    SELECT * INTO v_invoice
    FROM organizer_invoices
    WHERE provider_order_id = v_order_id OR id::TEXT = (p_payload->>'invoice_id');

    IF FOUND THEN
      -- Validate exact amount match: recorded amount must match expected payable amount exactly
      IF v_amount != v_invoice.total_payable THEN
        INSERT INTO payment_reconciliation_logs (
          reconciliation_type,
          reference_id,
          status,
          expected_amount,
          recorded_amount,
          discrepancy_amount,
          notes
        ) VALUES (
          'invoice_collection',
          v_invoice.invoice_number,
          'discrepancy',
          v_invoice.total_payable,
          v_amount,
          abs(v_invoice.total_payable - v_amount),
          'Amount mismatch detected via webhook: expected ₹' || v_invoice.total_payable || ', received ₹' || v_amount
        );

        UPDATE payment_webhook_events
        SET status = 'discrepancy'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'error', 'Payment amount mismatch detected',
          'expected', v_invoice.total_payable,
          'received', v_amount
        );
      END IF;

      -- Update invoice to escrow_funded
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        provider_payment_id = v_payment_id,
        paid_at = now(),
        updated_at = now()
      WHERE id = v_invoice.id;

      -- Log matched reconciliation
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type,
        reference_id,
        status,
        expected_amount,
        recorded_amount,
        discrepancy_amount,
        notes
      ) VALUES (
        'invoice_collection',
        v_invoice.invoice_number,
        'matched',
        v_invoice.total_payable,
        v_amount,
        0.00,
        'Full shift escrow locked via provider webhook'
      );
    END IF;

  ELSIF p_event_type = 'payout.processed' THEN
    -- Payout to worker succeeded
    v_record_id := (p_payload->>'payment_record_id')::UUID;
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);
    
    SELECT * INTO v_payout
    FROM payment_records
    WHERE id = v_record_id;

    IF FOUND THEN
      -- Validate exact payout amount match
      IF v_amount != v_payout.net_payout THEN
        INSERT INTO payment_reconciliation_logs (
          reconciliation_type,
          reference_id,
          status,
          expected_amount,
          recorded_amount,
          discrepancy_amount,
          notes
        ) VALUES (
          'payout',
          v_record_id::TEXT,
          'discrepancy',
          v_payout.net_payout,
          v_amount,
          abs(v_payout.net_payout - v_amount),
          'Payout amount mismatch: expected ₹' || v_payout.net_payout || ', received ₹' || v_amount
        );

        UPDATE payment_webhook_events
        SET status = 'discrepancy'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object('success', false, 'error', 'Payout amount mismatch');
      END IF;

      UPDATE payment_records
      SET
        status = 'settled',
        utr_reference = p_payload->>'utr',
        settled_at = now(),
        last_webhook_event_id = p_event_id
      WHERE id = v_record_id;

      INSERT INTO payment_reconciliation_logs (
        reconciliation_type,
        reference_id,
        status,
        expected_amount,
        recorded_amount,
        notes
      ) VALUES (
        'payout',
        v_record_id::TEXT,
        'matched',
        v_payout.net_payout,
        (p_payload->>'amount')::NUMERIC,
        'Worker direct UPI payout settled'
      );
    END IF;

  ELSIF p_event_type = 'payout.failed' THEN
    -- Payout failed (invalid UPI, bank server delay)
    v_record_id := (p_payload->>'payment_record_id')::UUID;

    UPDATE payment_records
    SET
      status = 'failed',
      failure_reason = p_payload->>'failure_reason',
      retry_count = retry_count + 1,
      last_webhook_event_id = p_event_id
    WHERE id = v_record_id;

    INSERT INTO payment_reconciliation_logs (
      reconciliation_type,
      reference_id,
      status,
      expected_amount,
      recorded_amount,
      discrepancy_amount,
      notes
    ) VALUES (
      'payout',
      v_record_id::TEXT,
      'discrepancy',
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      0.00,
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      'Payout failed: ' || COALESCE(p_payload->>'failure_reason', 'Bank error')
    );

  ELSIF p_event_type = 'payout.reversed' THEN
    -- Payout reversed by provider
    v_record_id := (p_payload->>'payment_record_id')::UUID;

    UPDATE payment_records
    SET
      status = 'refunded',
      failure_reason = 'Payout reversed by provider',
      last_webhook_event_id = p_event_id
    WHERE id = v_record_id;

    INSERT INTO payment_reconciliation_logs (
      reconciliation_type,
      reference_id,
      status,
      expected_amount,
      recorded_amount,
      notes
    ) VALUES (
      'reversal',
      v_record_id::TEXT,
      'reversed',
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      0.00,
      'Payout reversal logged'
    );
  END IF;

  -- Mark webhook event as processed
  UPDATE payment_webhook_events
  SET
    status = 'processed',
    processed_at = now()
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'status', 'processed'
  );
END;
$$;

-- 12. RPC: INITIATE WORKER PAYOUT (IDEMPOTENT & AUDITABLE)
CREATE OR REPLACE FUNCTION initiate_worker_payout_safe(
  p_booking_id UUID,
  p_upi_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_existing_payment RECORD;
  v_payment_id UUID;
  v_key TEXT;
BEGIN
  -- 1. Validate booking existence, lock row for concurrency protection & enforce completion
  SELECT b.*, j.organizer_id AS job_organizer_id
  INTO v_booking
  FROM bookings b
  JOIN jobs j ON j.id = b.job_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- 1b. Authorization check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_booking.job_organizer_id != auth.uid() AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only the shift organizer or administrator can initiate payout.');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shift attendance must be approved and completed prior to payout initiation (current status: ' || v_booking.status || ')'
    );
  END IF;

  -- 2. Validate UPI ID format
  IF p_upi_id !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid Indian UPI ID handle format');
  END IF;

  -- 3. Idempotency Key
  v_key := COALESCE(p_idempotency_key, 'payout-' || p_booking_id::TEXT);

  -- 4. Check existing payment record
  SELECT * INTO v_existing_payment
  FROM payment_records
  WHERE booking_id = p_booking_id;

  IF FOUND THEN
    IF v_existing_payment.status = 'settled' THEN
      RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_existing_payment.id,
        'status', 'settled',
        'utr', v_existing_payment.utr_reference,
        'message', 'Payout already settled'
      );
    END IF;

    -- Update pending or failed payout with new UPI ID
    UPDATE payment_records
    SET
      upi_id = p_upi_id,
      status = 'processing',
      failure_reason = null,
      idempotency_key = v_key
    WHERE id = v_existing_payment.id
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'status', 'processing',
      'amount', v_existing_payment.net_payout,
      'is_sandbox', true,
      'mode', 'sandbox_simulated'
    );
  END IF;

  -- 5. Insert fresh payment record in processing state awaiting provider settlement
  INSERT INTO payment_records (
    booking_id,
    job_id,
    worker_id,
    organizer_id,
    amount,
    platform_fee,
    net_payout,
    status,
    upi_id,
    escrow_locked_at,
    idempotency_key,
    is_sandbox
  ) VALUES (
    p_booking_id,
    v_booking.job_id,
    v_booking.worker_id,
    v_booking.job_organizer_id,
    v_booking.agreed_total_pay,
    0.00, -- 100% of agreed wage to worker
    v_booking.agreed_total_pay,
    'processing',
    p_upi_id,
    now(),
    v_key,
    true
  )
  RETURNING id INTO v_payment_id;

  -- Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, changes)
  VALUES (
    'worker_payout_initiated',
    'payment_records',
    v_payment_id,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'amount', v_booking.agreed_total_pay,
      'upi_id', p_upi_id,
      'status', 'processing',
      'is_sandbox', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', 'processing',
    'amount', v_booking.agreed_total_pay,
    'is_sandbox', true,
    'mode', 'sandbox_simulated',
    'message', 'Worker direct UPI payout initiated in sandbox mode. Awaiting provider confirmation.'
  );
END;
$$;

-- 14. SECURITY HARDENING: REVOKE UNRESTRICTED EXECUTE ON FINANCIAL RPCs
REVOKE EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION calculate_shift_financials_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION calculate_shift_financials_safe(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) TO authenticated;

