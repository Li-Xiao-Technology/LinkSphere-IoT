import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchResult, globalSearch } from '../api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: SearchResult) => void;
}

const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
  device: { label: '设备', icon: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>', color: '#005FB8' },
  scene: { label: '场景', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', color: '#FF6900' },
  rule: { label: '规则', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2.5"/>', color: '#107C10' },
  room: { label: '房间', icon: '<path d="M15 21h9v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2"/><polyline points="9 3 9 15"/>', color: '#0090E8' },
};

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  online: { bg: 'rgba(16, 124, 16, 0.1)', color: '#107C10', label: '在线' },
  offline: { bg: 'rgba(138, 138, 138, 0.1)', color: '#8A8A8A', label: '离线' },
  enabled: { bg: 'rgba(16, 124, 16, 0.1)', color: '#107C10', label: '启用' },
  disabled: { bg: 'rgba(196, 43, 28, 0.1)', color: '#C42B1C', label: '禁用' },
};

export function SearchModal({ isOpen, onClose, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const resetSearchState = useCallback(() => {
    setQuery('');
    setResults([]);
    setLoading(false);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetSearchState();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      resetSearchState();
    }
  }, [isOpen, resetSearchState]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await globalSearch(query);
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onSelectResult(results[selectedIndex]);
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelectResult, onClose]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.searchBox}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索设备、场景、规则或房间..."
            style={styles.input}
          />
          {query && (
            <button style={styles.clearButton} onClick={() => setQuery('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div style={styles.results}>
          {loading && (
            <div style={styles.loading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>搜索中...</span>
            </div>
          )}

          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div style={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D0D0D0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M16 6l4 4" />
              </svg>
              <div style={styles.emptyText}>未找到相关结果</div>
              <div style={styles.emptySubtext}>尝试使用其他关键词搜索</div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div style={styles.resultList}>
              {results.map((result, index) => {
                const typeInfo = typeConfig[result.type];
                const statusInfo = result.status ? statusConfig[result.status] : null;

                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    style={{
                      ...styles.resultItem,
                      ...(index === selectedIndex ? styles.resultItemSelected : {}),
                    }}
                    onClick={() => {
                      onSelectResult(result);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div style={{ ...styles.resultIcon, backgroundColor: typeInfo.color + '10', color: typeInfo.color }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: typeInfo.icon }} />
                    </div>
                    <div style={styles.resultContent}>
                      <div style={styles.resultName}>{result.name}</div>
                      <div style={styles.resultMeta}>
                        <span style={{ ...styles.resultType, backgroundColor: typeInfo.color + '10', color: typeInfo.color }}>{typeInfo.label}</span>
                        {result.description && <span style={styles.resultDescription}>{result.description}</span>}
                      </div>
                    </div>
                    {statusInfo && (
                      <div style={{ ...styles.resultStatus, backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <span style={styles.footerHint}>
            <kbd>↑↓</kbd> 导航 <kbd>Enter</kbd> 选择 <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 2000,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    animation: 'scaleIn 0.25s ease',
    margin: '0 20px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    background: '#FAFAFA',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    background: 'transparent',
    color: '#1A1A1A',
  },
  clearButton: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '8px 0',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 20px',
    color: '#8A8A8A',
    fontSize: '14px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '15px',
    color: '#1A1A1A',
    fontWeight: 500,
  },
  emptySubtext: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  resultList: {
    padding: '4px 0',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  resultItemSelected: {
    background: 'rgba(0, 95, 184, 0.06)',
  },
  resultIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultContent: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: '14px',
    color: '#1A1A1A',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  resultType: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  resultDescription: {
    fontSize: '12px',
    color: '#8A8A8A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resultStatus: {
    fontSize: '11px',
    padding: '3px 10px',
    borderRadius: '10px',
    fontWeight: 500,
    flexShrink: 0,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    background: '#FAFAFA',
  },
  footerHint: {
    fontSize: '12px',
    color: '#8A8A8A',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};
