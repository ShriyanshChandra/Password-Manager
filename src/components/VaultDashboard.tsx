import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Key,
  CreditCard,
  FileText,
  KeyRound,
  User,
  Star,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Edit,
  Trash2,
  Shield,
  Clock,
  Download,
  Upload,
  Sparkles,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import type { VaultCategory, VaultItem } from '../types/vault';
import { evaluatePasswordStrength, generateTOTP } from '../crypto/passwordUtils';
import { cyberAudio } from '../utils/cyberAudio';
import { copySecureToClipboard } from '../utils/clipboard';

interface VaultDashboardProps {
  items: VaultItem[];
  onSaveItem: (item: VaultItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenNewItemModal: () => void;
  onOpenEditItemModal: (item: VaultItem) => void;
  onOpenGenerator: () => void;
  onOpenAudit: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  items,
  onSaveItem,
  onDeleteItem,
  onOpenNewItemModal,
  onOpenEditItemModal,
  onOpenGenerator,
  onOpenAudit,
  onExportBackup,
  onImportBackup,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory | 'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showItemPassword, setShowItemPassword] = useState(false);

  // Live TOTP State
  const [totpCode, setTotpCode] = useState<string>('------');
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState<number>(30);

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  // Keep selectedItemId valid if items change
  useEffect(() => {
    if (!selectedItem && items.length > 0) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItem]);

  // Handle live TOTP updates for selected item
  useEffect(() => {
    if (!selectedItem?.totpSecret) {
      setTotpCode('------');
      return;
    }

    let isMounted = true;

    const updateCode = async () => {
      if (!selectedItem?.totpSecret) return;
      const res = await generateTOTP(selectedItem.totpSecret);
      if (isMounted) {
        setTotpCode(res.code);
        setTotpSecondsRemaining(res.secondsRemaining);
      }
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedItem?.totpSecret]);

  // Extract all unique tags
  const allTags = Array.from(
    new Set(items.flatMap((item) => item.tags || []).filter(Boolean))
  );

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedCategory === 'favorites' && !item.favorite) return false;
    if (selectedCategory !== 'all' && selectedCategory !== 'favorites' && item.category !== selectedCategory) {
      return false;
    }
    if (selectedTag && (!item.tags || !item.tags.includes(selectedTag))) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchUsername = item.username?.toLowerCase().includes(q);
      const matchUrl = item.url?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchUsername || matchUrl || matchNotes || matchTags;
    }
    return true;
  });

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    copySecureToClipboard(text, 45);
    cyberAudio.playCopySound();
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const getCategoryIcon = (category: VaultCategory) => {
    switch (category) {
      case 'login':
        return <Key size={14} color="var(--cyber-green)" />;
      case 'card':
        return <CreditCard size={14} color="var(--cyber-cyan)" />;
      case 'note':
        return <FileText size={14} color="var(--cyber-amber)" />;
      case 'api_key':
        return <KeyRound size={14} color="#ff77aa" />;
      case 'identity':
        return <User size={14} color="#99aaff" />;
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 65px)',
        overflow: 'hidden',
        background: 'rgba(238, 248, 255, 0.25)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Main 3-Column Layout */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '240px 380px 1fr',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* ========================================================= */}
        {/* COLUMN 1: SIDEBAR NAVIGATION                              */}
        {/* ========================================================= */}
        <aside
          style={{
            borderRight: '1px solid rgba(14, 165, 233, 0.16)',
            background: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px 12px',
            overflowY: 'auto',
          }}
        >
          <div>
            {/* New Entry Action Button */}
            <button
              onClick={() => {
                cyberAudio.playKeypress();
                onOpenNewItemModal();
              }}
              className="cyber-btn cyber-btn-primary w-full"
              style={{ marginBottom: '16px', padding: '10px 14px' }}
            >
              <Plus size={16} />
              <span>NEW SECURE ITEM</span>
            </button>

            {/* Categories Navigation */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--cyber-text-dim)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  marginBottom: '8px',
                  paddingLeft: '8px',
                }}
              >
                VAULT CATEGORIES
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('all');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'all' && !selectedTag ? 'var(--cyber-green-bg)' : 'transparent',
                    borderColor: selectedCategory === 'all' && !selectedTag ? 'var(--cyber-green)' : 'transparent',
                    color: selectedCategory === 'all' && !selectedTag ? 'var(--cyber-green)' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={14} />
                    <span>All Items</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{items.length}</span>
                </button>

                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('favorites');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'favorites' ? 'var(--cyber-amber-bg)' : 'transparent',
                    borderColor: selectedCategory === 'favorites' ? 'var(--cyber-amber)' : 'transparent',
                    color: selectedCategory === 'favorites' ? 'var(--cyber-amber)' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={14} />
                    <span>Favorites</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {items.filter((i) => i.favorite).length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('login');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'login' && !selectedTag ? 'var(--cyber-green-bg)' : 'transparent',
                    borderColor: selectedCategory === 'login' && !selectedTag ? 'var(--cyber-green)' : 'transparent',
                    color: selectedCategory === 'login' && !selectedTag ? 'var(--cyber-green)' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={14} />
                    <span>Logins</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {items.filter((i) => i.category === 'login').length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('card');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'card' && !selectedTag ? 'var(--cyber-cyan-bg)' : 'transparent',
                    borderColor: selectedCategory === 'card' && !selectedTag ? 'var(--cyber-cyan)' : 'transparent',
                    color: selectedCategory === 'card' && !selectedTag ? 'var(--cyber-cyan)' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={14} />
                    <span>Cards</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {items.filter((i) => i.category === 'card').length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('note');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'note' && !selectedTag ? 'rgba(255,176,0,0.1)' : 'transparent',
                    borderColor: selectedCategory === 'note' && !selectedTag ? 'var(--cyber-amber)' : 'transparent',
                    color: selectedCategory === 'note' && !selectedTag ? 'var(--cyber-amber)' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={14} />
                    <span>Secure Notes</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {items.filter((i) => i.category === 'note').length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setSelectedCategory('api_key');
                    setSelectedTag(null);
                  }}
                  className="cyber-btn"
                  style={{
                    justifyContent: 'space-between',
                    background: selectedCategory === 'api_key' && !selectedTag ? 'rgba(255,119,170,0.1)' : 'transparent',
                    borderColor: selectedCategory === 'api_key' && !selectedTag ? '#ff77aa' : 'transparent',
                    color: selectedCategory === 'api_key' && !selectedTag ? '#ff77aa' : 'var(--cyber-text-main)',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KeyRound size={14} />
                    <span>API & Keys</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    {items.filter((i) => i.category === 'api_key').length}
                  </span>
                </button>
              </div>
            </div>

            {/* Tags Section */}
            {allTags.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--cyber-text-dim)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    marginBottom: '8px',
                    paddingLeft: '8px',
                  }}
                >
                  ENCRYPTED TAGS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4px' }}>
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        cyberAudio.playKeypress();
                        setSelectedTag(selectedTag === t ? null : t);
                      }}
                      className="cyber-badge"
                      style={{
                        background: selectedTag === t ? 'var(--cyber-green)' : 'rgba(14, 165, 233, 0.08)',
                        color: selectedTag === t ? '#fff' : 'var(--cyber-text-muted)',
                        borderColor: selectedTag === t ? 'var(--cyber-green)' : 'rgba(14, 165, 233, 0.2)',
                        cursor: 'pointer',
                        fontSize: '10.5px',
                      }}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Tools */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '12px', borderTop: '1px solid var(--cyber-border-dim)' }}>
            <button
              onClick={() => {
                cyberAudio.playKeypress();
                onOpenAudit();
              }}
              className="cyber-btn cyber-btn-secondary w-full"
              style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px' }}
            >
              <ShieldAlert size={14} color="var(--cyber-amber)" />
              <span>Security Center</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playKeypress();
                onOpenGenerator();
              }}
              className="cyber-btn cyber-btn-secondary w-full"
              style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px' }}
            >
              <Sparkles size={14} color="var(--cyber-green)" />
              <span>Password Generator</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playKeypress();
                onExportBackup();
              }}
              className="cyber-btn cyber-btn-secondary w-full"
              style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px' }}
            >
              <Download size={14} color="var(--cyber-cyan)" />
              <span>Export Encrypted JSON</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playKeypress();
                fileInputRef.current?.click();
              }}
              className="cyber-btn cyber-btn-secondary w-full"
              style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px' }}
            >
              <Upload size={14} color="var(--cyber-text-muted)" />
              <span>Import Backup</span>
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* COLUMN 2: SEARCH & CREDENTIALS LIST                      */}
        {/* ========================================================= */}
        <section
          style={{
            borderRight: '1px solid rgba(14, 165, 233, 0.16)',
            background: 'rgba(255, 255, 255, 0.68)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--cyber-border-dim)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search credentials, URLs, tags..."
                className="cyber-input"
                style={{ paddingLeft: '32px', fontSize: '12.5px', padding: '8px 12px 8px 32px' }}
              />
              <Search
                size={14}
                color="var(--cyber-text-dim)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          {/* List of items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--cyber-text-dim)' }}>
                <Shield size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <div style={{ fontSize: '13px' }}>No encrypted entries found.</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Click "+ NEW SECURE ITEM" to create one.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredItems.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  const itemStrength = item.password ? evaluatePasswordStrength(item.password) : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        cyberAudio.playKeypress();
                        setSelectedItemId(item.id);
                        setShowItemPassword(false);
                      }}
                      className="cyber-card"
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--anime-sky)' : 'rgba(14, 165, 233, 0.16)',
                        background: isSelected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.72)',
                        boxShadow: isSelected ? '0 4px 16px rgba(2, 132, 199, 0.15)' : 'none',
                        borderRadius: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(14, 165, 233, 0.08)',
                              border: '1px solid rgba(14, 165, 233, 0.18)',
                              borderRadius: '6px',
                            }}
                          >
                            {getCategoryIcon(item.category)}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 600,
                                color: isSelected ? 'var(--cyber-green)' : 'var(--cyber-text-main)',
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--cyber-text-muted)',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.username || item.cardNumber || item.url || 'No username'}
                            </div>
                          </div>
                        </div>

                        {item.favorite && (
                          <Star size={13} fill="var(--cyber-amber)" color="var(--cyber-amber)" />
                        )}
                      </div>

                      {/* Micro Footer: Strength & TOTP indicator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '8px',
                          paddingTop: '6px',
                          borderTop: '1px solid rgba(14, 165, 233, 0.12)',
                          fontSize: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {itemStrength && (
                            <span
                              style={{
                                color:
                                  itemStrength.score >= 3
                                    ? 'var(--cyber-green)'
                                    : itemStrength.score >= 2
                                    ? 'var(--cyber-amber)'
                                    : 'var(--cyber-red)',
                                fontWeight: 600,
                              }}
                            >
                              {itemStrength.label}
                            </span>
                          )}
                          {item.totpSecret && (
                            <span className="cyber-badge cyber-badge-cyan" style={{ fontSize: '9px', padding: '1px 4px' }}>
                              2FA
                            </span>
                          )}
                        </div>

                        {/* Quick Copy Buttons */}
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          {item.username && (
                            <button
                              onClick={() => handleCopy(item.username!, `list-user-${item.id}`)}
                              className="cyber-btn cyber-btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              title="Copy username"
                            >
                              {copiedField === `list-user-${item.id}` ? <Check size={10} /> : <User size={10} />}
                            </button>
                          )}
                          {item.password && (
                            <button
                              onClick={() => handleCopy(item.password!, `list-pwd-${item.id}`)}
                              className="cyber-btn cyber-btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              title="Copy password"
                            >
                              {copiedField === `list-pwd-${item.id}` ? <Check size={10} /> : <Key size={10} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* COLUMN 3: SELECTED ITEM DETAILS & ACTIONS                 */}
        {/* ========================================================= */}
        <main
          style={{
            background: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '28px',
          }}
        >
          {selectedItem ? (
            <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto' }}>
              {/* Top Banner Action Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid var(--cyber-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(14, 165, 233, 0.22)',
                      background: 'rgba(14, 165, 233, 0.08)',
                      borderRadius: '10px',
                    }}
                  >
                    {getCategoryIcon(selectedItem.category)}
                  </div>
                  <div>
                    <h1 style={{ fontSize: '20px', color: 'var(--cyber-text-main)', margin: 0 }}>
                      {selectedItem.title}
                    </h1>
                    <div style={{ fontSize: '11px', color: 'var(--cyber-text-dim)', marginTop: '2px' }}>
                      UPDATED: {new Date(selectedItem.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      cyberAudio.playKeypress();
                      onSaveItem({ ...selectedItem, favorite: !selectedItem.favorite });
                    }}
                    className="cyber-btn cyber-btn-secondary cyber-btn-icon"
                    title="Toggle Favorite"
                  >
                    <Star
                      size={15}
                      fill={selectedItem.favorite ? 'var(--cyber-amber)' : 'none'}
                      color={selectedItem.favorite ? 'var(--cyber-amber)' : 'var(--cyber-text-dim)'}
                    />
                  </button>

                  <button
                    onClick={() => {
                      cyberAudio.playKeypress();
                      onOpenEditItemModal(selectedItem);
                    }}
                    className="cyber-btn cyber-btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    <Edit size={14} />
                    <span>EDIT</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Purge "${selectedItem.title}" permanently?`)) {
                        cyberAudio.playErrorSound();
                        onDeleteItem(selectedItem.id);
                      }
                    }}
                    className="cyber-btn cyber-btn-danger cyber-btn-icon"
                    title="Delete item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Detail Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Username Section */}
                {selectedItem.username && (
                  <div className="cyber-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', fontWeight: 600 }}>
                        USERNAME / EMAIL / ACCOUNT
                      </span>
                      <button
                        onClick={() => handleCopy(selectedItem.username!, 'detail-username')}
                        className="cyber-btn cyber-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        {copiedField === 'detail-username' ? <Check size={12} color="var(--cyber-green)" /> : <Copy size={12} />}
                        <span>{copiedField === 'detail-username' ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--cyber-text-main)', fontFamily: 'var(--font-mono)' }}>
                      {selectedItem.username}
                    </div>
                  </div>
                )}

                {/* Password Section */}
                {selectedItem.password && (
                  <div className="cyber-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', fontWeight: 600 }}>
                        PASSWORD (AES-256 ENCRYPTED)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setShowItemPassword(!showItemPassword)}
                          className="cyber-btn cyber-btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          {showItemPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                          <span>{showItemPassword ? 'HIDE' : 'REVEAL'}</span>
                        </button>

                        <button
                          onClick={() => handleCopy(selectedItem.password!, 'detail-pwd')}
                          className="cyber-btn cyber-btn-primary"
                          style={{ padding: '3px 12px', fontSize: '11px' }}
                        >
                          {copiedField === 'detail-pwd' ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === 'detail-pwd' ? 'COPIED TO CLIPBOARD' : 'COPY'}</span>
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: showItemPassword ? 'normal' : '0.25em',
                        color: 'var(--anime-turquoise)',
                        background: 'rgba(13, 148, 136, 0.07)',
                        padding: '10px 14px',
                        border: '1px solid rgba(13, 148, 136, 0.2)',
                        borderRadius: '8px',
                      }}
                    >
                      {showItemPassword ? selectedItem.password : '••••••••••••••••••••'}
                    </div>

                    {/* Entropy Score Meter */}
                    {(() => {
                      const st = evaluatePasswordStrength(selectedItem.password);
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px' }}>
                          <span style={{ color: st.score >= 3 ? 'var(--cyber-green)' : 'var(--cyber-amber)' }}>
                            Entropy: {st.entropy} bits ({st.label})
                          </span>
                          <span style={{ color: 'var(--cyber-text-dim)' }}>
                            Estimated Crack Time: {st.crackTimeDisplay}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TOTP Live 2FA Authenticator Section */}
                {selectedItem.totpSecret && (
                  <div
                    className="cyber-card"
                    style={{
                      padding: '16px',
                      background: 'rgba(2, 132, 199, 0.07)',
                      borderColor: 'rgba(2, 132, 199, 0.25)',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} color="var(--cyber-cyan)" />
                        <span style={{ fontSize: '11px', color: 'var(--cyber-cyan)', fontWeight: 700 }}>
                          LIVE 2FA AUTHENTICATOR CODE (RFC 6238)
                        </span>
                      </div>

                      <div className="cyber-badge cyber-badge-cyan" style={{ fontSize: '11px' }}>
                        REFRESH IN {totpSecondsRemaining}s
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div
                        className="font-display"
                        style={{
                          fontSize: '28px',
                          fontWeight: 900,
                          color: 'var(--cyber-cyan)',
                          letterSpacing: '0.18em',
                        }}
                      >
                        {totpCode.slice(0, 3)} {totpCode.slice(3)}
                      </div>

                      <button
                        onClick={() => handleCopy(totpCode, 'detail-totp')}
                        className="cyber-btn cyber-btn-secondary"
                        style={{ borderColor: 'var(--cyber-cyan)', color: 'var(--cyber-cyan)' }}
                      >
                        {copiedField === 'detail-totp' ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'detail-totp' ? 'COPIED 2FA CODE' : 'COPY 2FA'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Website / URL */}
                {selectedItem.url && (
                  <div className="cyber-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', fontWeight: 600 }}>
                        LOGIN URL
                      </span>
                      <a
                        href={selectedItem.url.startsWith('http') ? selectedItem.url : `https://${selectedItem.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cyber-btn cyber-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <ExternalLink size={12} />
                        <span>LAUNCH SITE</span>
                      </a>
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--cyber-text-main)', wordBreak: 'break-all' }}>
                      {selectedItem.url}
                    </div>
                  </div>
                )}

                {/* Card Details (if card category) */}
                {selectedItem.category === 'card' && (
                  <div className="cyber-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', fontWeight: 600, marginBottom: '10px' }}>
                      VIRTUAL / PHYSICAL PAYMENT CARD
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--cyber-text-dim)' }}>CARD NUMBER</div>
                        <div style={{ fontSize: '15px', color: 'var(--cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {selectedItem.cardNumber || '•••• •••• •••• ••••'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--cyber-text-dim)' }}>CARDHOLDER</div>
                        <div style={{ fontSize: '14px', color: 'var(--cyber-text-main)' }}>
                          {selectedItem.cardHolder || 'CIPHER HOLDER'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--cyber-text-dim)' }}>EXPIRY</div>
                        <div style={{ fontSize: '14px', color: 'var(--cyber-text-main)' }}>
                          {selectedItem.cardExpiry || 'MM/YY'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--cyber-text-dim)' }}>CVV</div>
                        <div style={{ fontSize: '14px', color: 'var(--cyber-amber)' }}>
                          {selectedItem.cardCvv || '•••'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedItem.notes && (
                  <div className="cyber-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', fontWeight: 600 }}>
                        ENCRYPTED NOTES
                      </span>
                      <button
                        onClick={() => handleCopy(selectedItem.notes!, 'detail-notes')}
                        className="cyber-btn cyber-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        {copiedField === 'detail-notes' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedField === 'detail-notes' ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12.5px',
                        color: 'var(--cyber-text-main)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                      }}
                    >
                      {selectedItem.notes}
                    </pre>
                  </div>
                )}

                {/* Tags */}
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Tag size={14} color="var(--cyber-text-dim)" />
                    {selectedItem.tags.map((t) => (
                      <span key={t} className="cyber-badge cyber-badge-green" style={{ fontSize: '11px' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cyber-text-dim)',
              }}
            >
              <Shield size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>SELECT AN ENTRY FROM THE LIST</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Or create a new encrypted record using "+ NEW SECURE ITEM".
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
