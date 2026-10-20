import { resolveVerificationDocumentExtension } from '../supabase/profiles';

describe('resolveVerificationDocumentExtension', () => {
  it('maps image MIME types to image extensions', () => {
    expect(resolveVerificationDocumentExtension('image/png')).toBe('png');
    expect(resolveVerificationDocumentExtension('image/jpeg')).toBe('jpg');
    expect(resolveVerificationDocumentExtension('image/jpg')).toBe('jpg');
  });

  it('maps plain-text GSTIN evidence to .txt (not .pdf)', () => {
    expect(resolveVerificationDocumentExtension('text/plain')).toBe('txt');
    expect(resolveVerificationDocumentExtension('TEXT/PLAIN; charset=utf-8')).toBe('txt');
  });

  it('defaults unknown types to pdf', () => {
    expect(resolveVerificationDocumentExtension('application/pdf')).toBe('pdf');
    expect(resolveVerificationDocumentExtension('application/octet-stream')).toBe('pdf');
    expect(resolveVerificationDocumentExtension('')).toBe('pdf');
  });
});
