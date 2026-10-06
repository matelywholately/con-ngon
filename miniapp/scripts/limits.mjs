export const MAX_APP_BYTES = 10_000_000;
export const MAX_FILE_BYTES = 3_000_000;
export function checkLimits(files) {
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const largest = files.reduce((a, b) => b.bytes > a.bytes ? b : a, { path: '', bytes: 0 });
  if (totalBytes > MAX_APP_BYTES) throw new Error('App exceeds 10 MB');
  if (largest.bytes > MAX_FILE_BYTES) throw new Error(`File exceeds 3 MB: ${largest.path}`);
  return { totalBytes, largest, fileCount: files.length, maxAppBytes: MAX_APP_BYTES, maxFileBytes: MAX_FILE_BYTES };
}
export function checkRelease(report) {
  if (report.demo) throw new Error('Demo builds cannot be submitted. Run npm run build.');
  if (!report.backendConfigured) throw new Error('Set the public Supabase URL and anon key, then rebuild.');
  if (!/^\d{1,30}$/.test(report.miniAppId)) throw new Error('Set the actual APP_ID from Zalo, then rebuild.');
  checkLimits(report.files);
}
