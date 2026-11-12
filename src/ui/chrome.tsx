import { useEffect, useState, type ReactNode } from 'react';
import type { TabId } from '../types';
import { Disc } from './icons';
import { IconBookmark, IconCollection, IconGear, IconPlus } from './icons';

export function CoverImg({ blob, className, alt }: { blob: Blob | null; className?: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return <Disc className={className || 'ph'} />;
  return <img className={className || 'sleeve'} src={url} alt={alt} />;
}

export function Screen({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  return (
    <div
      className="scroll"
      onScroll={(e) => setCompact(e.currentTarget.scrollTop > 24)}
    >
      <header className="topbar">
        <div className={compact ? 'compact-title show' : 'compact-title'}>{title}</div>
        <div className="top-actions">{actions}</div>
      </header>
      <div className="title-block">
        <h1 className="large-title">{title}</h1>
        {count ? <p className="count">{count}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  testId,
  action,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  action?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.classList.add('sheet-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <>
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div className={action ? 'sheet action' : 'sheet'} role="dialog" aria-modal="true" aria-label={title || 'Sheet'} data-testid={testId}>
        <div className="grabber" />
        <div className="sheet-bar">
          <button className="btn ghost" type="button" onClick={onClose} data-testid="sheet-close">
            Close
          </button>
          {title ? <h2 className="sheet-title">{title}</h2> : <span />}
        </div>
        <div className="sheet-scroll">{children}</div>
      </div>
    </>
  );
}

const TABS: { id: TabId; label: string; wish?: boolean }[] = [
  { id: 'collection', label: 'Collection' },
  { id: 'wishlist', label: 'Wishlist', wish: true },
  { id: 'add', label: 'Add' },
  { id: 'settings', label: 'Settings' },
];

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((item) => (
        <button
          key={item.id}
          className={tab === item.id ? (item.wish ? 'on wish' : 'on') : undefined}
          aria-current={tab === item.id ? 'page' : undefined}
          data-testid={`tab-${item.id}`}
          onClick={() => {
            navigator.vibrate?.(8);
            onChange(item.id);
          }}
        >
          {item.id === 'add' ? (
            <span className="add-pill">
              <IconPlus />
            </span>
          ) : item.id === 'collection' ? (
            <IconCollection />
          ) : item.id === 'wishlist' ? (
            <IconBookmark />
          ) : (
            <IconGear />
          )}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
