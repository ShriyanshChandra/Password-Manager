import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CreditCard,
  FileText,
  Key,
  User,
  Star,
  Globe,
  Save,
  Trash2,
} from 'lucide-react';
import type { VaultCategory, VaultItem } from '../types/vault';
import { evaluatePasswordStrength, generatePassword } from '../crypto/passwordUtils';
import { cyberAudio } from '../utils/cyberAudio';

interface ItemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: VaultItem | null; // null if creating new item
  onSave: (item: VaultItem) => void;
  onDelete?: (id: string) => void;
  onOpenGenerator: (onSelect?: (password: string) => void) => void;
}

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete,
  onOpenGenerator,
}) => {
  const [formData, setFormData] = useState<Partial<VaultItem>>({
    title: '',
    category: 'login',
    username: '',
    password: '',
    url: '',
    notes: '',
    totpSecret: '',
    tags: [],
    favorite: false,
  });

  const [tagsInput, setTagsInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
      setTagsInput(item.tags ? item.tags.join(', ') : '');
    } else {
      setFormData({
        id: 'item-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: '',
        category: 'login',
        username: '',
        password: '',
        url: '',
        notes: '',
        totpSecret: '',
        tags: [],
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setTagsInput('');
    }
    setShowPassword(false);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const strength = evaluatePasswordStrength(formData.password || '');

  const handleQuickGenerate = () => {
    cyberAudio.playKeypress();
    const pwd = generatePassword({
      length: 20,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true,
      avoidAmbiguous: true,
      mode: 'password',
    });
    setFormData((prev) => ({ ...prev, password: pwd }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      alert('Title is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const completeItem: VaultItem = {
      id: formData.id || 'item-' + Date.now(),
      title: formData.title.trim(),
      category: formData.category || 'login',
      username: formData.username,
      password: formData.password,
      url: formData.url,
      notes: formData.notes,
      totpSecret: formData.totpSecret,
      tags,
      favorite: !!formData.favorite,
      createdAt: formData.createdAt || Date.now(),
      updatedAt: Date.now(),
      cardNumber: formData.cardNumber,
      cardExpiry: formData.cardExpiry,
      cardCvv: formData.cardCvv,
      cardHolder: formData.cardHolder,
    };

    cyberAudio.playCopySound();
    onSave(completeItem);
    onClose();
  };

  const categories: { key: VaultCategory; label: string; icon: React.ReactNode }[] = [
    { key: 'login', label: 'Login', icon: <Key size={14} /> },
    { key: 'card', label: 'Card', icon: <CreditCard size={14} /> },
    { key: 'note', label: 'Secure Note', icon: <FileText size={14} /> },
    { key: 'api_key', label: 'API Key', icon: <KeyRound size={14} /> },
    { key: 'identity', label: 'Identity', icon: <User size={14} /> },
  ];

  return (
    <div className="cyber-modal-backdrop">
      <div
        className="cyber-card cyber-corners"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255, 255, 255, 0.93)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(14, 165, 233, 0.22)',
          boxShadow: '0 20px 60px -8px rgba(14, 116, 144, 0.22), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '24px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={20} color="var(--cyber-green)" />
            <h2 style={{ fontSize: '16px', letterSpacing: '0.08em', color: 'var(--cyber-green)' }}>
              {item ? 'EDIT SECURE ENTRY' : 'NEW ENCRYPTED ENTRY'}
            </h2>
          </div>
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: 'var(--cyber-text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Category Tabs */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '6px' }}>
              ENTRY CATEGORY
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => {
                    cyberAudio.playKeypress();
                    setFormData({ ...formData, category: c.key });
                  }}
                  className="cyber-btn"
                  style={{
                    background: formData.category === c.key ? 'var(--cyber-green)' : 'rgba(255,255,255,0.03)',
                    color: formData.category === c.key ? '#000' : 'var(--cyber-text-main)',
                    borderColor: formData.category === c.key ? 'var(--cyber-green)' : 'var(--cyber-border-dim)',
                    padding: '6px 4px',
                    fontSize: '11px',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {c.icon}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title & Favorite */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                ITEM TITLE *
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="E.g., GitHub Core, AWS Vault, Personal Banking..."
                className="cyber-input"
                required
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => {
                cyberAudio.playKeypress();
                setFormData({ ...formData, favorite: !formData.favorite });
              }}
              className="cyber-btn cyber-btn-secondary cyber-btn-icon"
              style={{
                color: formData.favorite ? 'var(--cyber-amber)' : 'var(--cyber-text-dim)',
                borderColor: formData.favorite ? 'var(--cyber-amber)' : 'var(--cyber-border-dim)',
              }}
              title="Toggle Favorite"
            >
              <Star size={16} fill={formData.favorite ? 'var(--cyber-amber)' : 'none'} />
            </button>
          </div>

          {/* Login / API Key Fields */}
          {(formData.category === 'login' || formData.category === 'api_key' || formData.category === 'identity') && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                  USERNAME / EMAIL / ACCESS ID
                </label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="name@matrix.org or username"
                  className="cyber-input"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--cyber-text-muted)' }}>
                    PASSWORD / SECRET KEY
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleQuickGenerate}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--cyber-green)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={11} />
                      <span>QUICK GEN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cyberAudio.playKeypress();
                        onOpenGenerator((newPassword) => {
                          setFormData((prev) => ({ ...prev, password: newPassword }));
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--cyber-cyan)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>ADVANCED GEN</span>
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password..."
                    className="cyber-input"
                    style={{ paddingRight: '40px', letterSpacing: showPassword ? 'normal' : '0.15em' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--cyber-text-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {formData.password && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                    <span style={{ color: strength.score >= 3 ? 'var(--cyber-green)' : 'var(--cyber-amber)' }}>
                      Entropy: {strength.entropy} bits ({strength.label})
                    </span>
                    <span style={{ color: 'var(--cyber-text-dim)' }}>
                      Crack Time: {strength.crackTimeDisplay}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                  WEBSITE / LOGIN URL
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={formData.url || ''}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    className="cyber-input"
                  />
                  {formData.url && (
                    <a
                      href={formData.url.startsWith('http') ? formData.url : `https://${formData.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cyber-btn cyber-btn-secondary cyber-btn-icon"
                      title="Open URL"
                    >
                      <Globe size={15} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                  TOTP 2FA SECRET (RFC 6238 BASE-32 KEY)
                </label>
                <input
                  type="text"
                  value={formData.totpSecret || ''}
                  onChange={(e) => setFormData({ ...formData, totpSecret: e.target.value })}
                  placeholder="E.g., JBSWY3DPEHPK3PXP"
                  className="cyber-input"
                  style={{ textTransform: 'uppercase' }}
                />
                <span style={{ fontSize: '10.5px', color: 'var(--cyber-text-dim)', marginTop: '2px', display: 'block' }}>
                  Enables live 30-second two-factor authentication codes in your dashboard.
                </span>
              </div>
            </>
          )}

          {/* Credit Card Specific Fields */}
          {formData.category === 'card' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                  CARDHOLDER NAME
                </label>
                <input
                  type="text"
                  value={formData.cardHolder || ''}
                  onChange={(e) => setFormData({ ...formData, cardHolder: e.target.value })}
                  placeholder="CIPHER HOLDER"
                  className="cyber-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                  CARD NUMBER
                </label>
                <input
                  type="text"
                  value={formData.cardNumber || ''}
                  onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                  placeholder="4532 0000 0000 0000"
                  className="cyber-input"
                  style={{ letterSpacing: '0.1em' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                    EXPIRY (MM/YY)
                  </label>
                  <input
                    type="text"
                    value={formData.cardExpiry || ''}
                    onChange={(e) => setFormData({ ...formData, cardExpiry: e.target.value })}
                    placeholder="12/28"
                    className="cyber-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                    CVV / CVC
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={formData.cardCvv || ''}
                    onChange={(e) => setFormData({ ...formData, cardCvv: e.target.value })}
                    placeholder="789"
                    className="cyber-input"
                  />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
              ENCRYPTED NOTES & PAYLOAD
            </label>
            <textarea
              rows={4}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Recovery keys, private configuration, answers to security questions..."
              className="cyber-input"
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
              TAGS (COMMA SEPARATED)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="dev, crypto, finance, priority..."
              className="cyber-input"
            />
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--cyber-border-dim)',
              marginTop: '8px',
            }}
          >
            {item && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Purge "${item.title}" permanently from vault?`)) {
                    cyberAudio.playErrorSound();
                    onDelete(item.id);
                    onClose();
                  }
                }}
                className="cyber-btn cyber-btn-danger"
                style={{ fontSize: '12px' }}
              >
                <Trash2 size={13} />
                <span>PURGE</span>
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} className="cyber-btn cyber-btn-secondary">
                CANCEL
              </button>
              <button type="submit" className="cyber-btn cyber-btn-primary">
                <Save size={14} />
                <span>SAVE & ENCRYPT</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
