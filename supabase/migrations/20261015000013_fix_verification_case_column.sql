-- Migration 20261015000013: Fix document_masked_id in submit_verification_case_safe
-- Replaces erroneous 'document_number_masked' with actual table column 'document_masked_id'

CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_masked_id, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;
