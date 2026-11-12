import type { SVGProps } from 'react';

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props} />
  );
}

export function IconCollection() {
  return (
    <Svg>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </Svg>
  );
}
export function IconList() {
  return (
    <Svg>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}
export function IconBookmark() {
  return (
    <Svg>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.2L6 20V5.5a1 1 0 0 1 1-1z" />
    </Svg>
  );
}
export function IconPlus() {
  return (
    <Svg width="18" height="18">
      <path d="M9 3.5v11M3.5 9h11" />
    </Svg>
  );
}
export function IconGear() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </Svg>
  );
}
export function IconSearch() {
  return (
    <Svg width="18" height="18">
      <circle cx="8" cy="8" r="4.5" />
      <path d="M11.5 11.5 16 16" />
    </Svg>
  );
}
export function IconCamera() {
  return (
    <Svg>
      <path d="M8 7.5 9.2 5.5h5.6L16 7.5h2.2A1.3 1.3 0 0 1 19.5 8.8v8.4a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3V8.8a1.3 1.3 0 0 1 1.3-1.3H8z" />
      <circle cx="12" cy="13" r="2.6" />
    </Svg>
  );
}
export function IconSort() {
  return (
    <Svg>
      <path d="M8 5.5v13M5.5 8 8 5.5 10.5 8M16 18.5v-13M13.5 16 16 18.5 18.5 16" />
    </Svg>
  );
}
export function IconChevron() {
  return (
    <Svg width="16" height="16">
      <path d="M6 4.5 11 12 6 19.5" />
    </Svg>
  );
}

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#E39A3B" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#1E1713" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="2.3" fill="#1E1713" />
    </svg>
  );
}

export function Disc({ className }: { className?: string }) {
  return (
    <div className={className || 'ph'} aria-hidden>
      <svg width="46%" height="46%" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="12" fill="none" stroke="#B8955A" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="3" fill="#E39A3B" />
      </svg>
    </div>
  );
}
