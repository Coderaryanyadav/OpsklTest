-- Migration: 20261015000007_fix_invoice_platform_settings_keys.sql
-- Description: Expand organizer_invoices constraints, standardize platform_settings aliases, and fix generate_job_invoice_safe calculation & return payload

-- 1. Expand organizer_invoices check constraints to safely support 'issued' status and 'bank_transfer' method
ALTER TABLE organizer_invoices DROP CONSTRAINT IF EXISTS organizer_invoices_status_check;
ALTER TABLE organizer_invoices ADD CONSTRAINT organizer_invoices_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'issued'::text, 'escrow_funded'::text, 'settled'::text, 'overdue'::text, 'cancelled'::text]));

ALTER TABLE organizer_invoices DROP CONSTRAINT IF EXISTS organizer_invoices_payment_method_check;
ALTER TABLE organizer_invoices ADD CONSTRAINT organizer_invoices_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['upi'::text, 'netbanking'::text, 'neft_rtgs'::text, 'corporate_card'::text, 'sandbox_mock'::text, 'bank_transfer'::text]));

-- 2. Ensure platform_settings has both legacy and percent-suffixed keys with robust scalar numeric values
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('platform_fee_percent', '10.0'::jsonb, 'Standard Opskl marketplace service fee percentage charged to organizers'),
  ('gst_rate_percent', '18.0'::jsonb, 'Indian GST rate applied strictly to the platform service fee (SAC 998519)'),
  ('min_hourly_wage_inr', '100.0'::jsonb, 'Enforced minimum hourly wage floor in INR to protect workers from sub-minimum wages'),
  ('platform_fee', '10.0'::jsonb, 'Legacy alias for platform fee percentage'),
  ('gst_rate', '18.0'::jsonb, 'Legacy alias for GST rate percentage'),
  ('min_wage', '100.0'::jsonb, 'Legacy alias for min hourly wage INR'),
  ('checkin_radius_m', '300.0'::jsonb, 'Checkin radius tolerance in meters')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Update generate_job_invoice_safe to be fully resilient and return invoice_number on update
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
  v_existing RECORD;
  v_wage_total NUMERIC(10, 2);
  v_fee_pct NUMERIC(5, 2);
  v_gst_pct NUMERIC(5, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  SELECT id, organizer_id, total_pay, slots_total, date INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Idempotency check: refuse to alter totals if already funded or settled
  SELECT * INTO v_existing FROM organizer_invoices WHERE job_id = p_job_id;
  IF FOUND THEN
    IF v_existing.status IN ('escrow_funded', 'settled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'status', v_existing.status,
        'total_payable', v_existing.total_payable,
        'immutable', true
      );
    END IF;
  END IF;

  -- Fetch dynamic fee and GST percentages from platform settings with robust fallbacks
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'platform_fee_percent')::numeric
    END, 
    10.00
  ) INTO v_fee_pct
  FROM platform_settings WHERE key IN ('platform_fee_percent', 'platform_fee')
  LIMIT 1;

  IF v_fee_pct IS NULL THEN v_fee_pct := 10.00; END IF;

  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'gst_rate_percent')::numeric
    END, 
    18.00
  ) INTO v_gst_pct
  FROM platform_settings WHERE key IN ('gst_rate_percent', 'gst_rate')
  LIMIT 1;

  IF v_gst_pct IS NULL THEN v_gst_pct := 18.00; END IF;

  v_wage_total := round(v_job.total_pay * v_job.slots_total, 2);
  v_platform_fee := round(v_wage_total * (v_fee_pct / 100.0), 2);
  v_gst_amount := round(v_platform_fee * (v_gst_pct / 100.0), 2);
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  -- Due date: least(now() + 3 days, job.date - 1 day)
  v_due_date := LEAST(
    now() + interval '3 days',
    (v_job.date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  IF v_existing.id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = v_wage_total,
      platform_fee = v_platform_fee,
      gst_rate = v_gst_pct,
      gst_amount = v_gst_amount,
      total_payable = v_total_payable,
      due_date = v_due_date,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
      'success', true, 
      'invoice_id', v_invoice_id, 
      'invoice_number', v_existing.invoice_number,
      'status', 'updated', 
      'total_payable', v_total_payable
    );
  END IF;

  v_invoice_number := generate_invoice_number();

  INSERT INTO organizer_invoices (
    invoice_number, job_id, organizer_id,
    wage_total, platform_fee, gst_rate, gst_amount, total_payable,
    status, payment_method, payment_provider, due_date, is_sandbox
  ) VALUES (
    v_invoice_number, p_job_id, v_job.organizer_id,
    v_wage_total, v_platform_fee, v_gst_pct, v_gst_amount, v_total_payable,
    'issued', 'bank_transfer', 'razorpay', v_due_date, true
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'issued',
    'total_payable', v_total_payable
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) TO authenticated;
