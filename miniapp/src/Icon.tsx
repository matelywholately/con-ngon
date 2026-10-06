type Name = 'bowl' | 'qr' | 'pin' | 'search' | 'clock' | 'leaf' | 'receipt' | 'person' | 'arrow' | 'back' | 'refresh' | 'check' | 'shield';
const paths: Record<Name, string> = {
  bowl: 'M3 11h18c0 6-3 9-9 9s-9-3-9-9ZM6 21h12M8 3v4m4-5v5m4-4v4',
  qr: 'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h2v2h-2zm4 0h2v6h-6v-2m-3-7h5M3 12h5m4-9v5m0 7v6',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  leaf: 'M5 19c-5-8 0-15 15-15 0 15-7 20-15 15Zm0 0L15 9',
  receipt: 'M5 3l3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2ZM8 9h8m-8 4h8m-8 4h5',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6',
  refresh: 'M20 8a9 9 0 1 0 1 7M20 3v5h-5', check: 'm5 12 4 4L19 6',
  shield: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6',
};
export function Icon({ name, className = '' }: { name: Name; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
