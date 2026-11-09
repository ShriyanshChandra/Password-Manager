import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Copy, Check, ShieldCheck, Sliders } from 'lucide-react';
import type { PasswordGeneratorOptions } from '../types/vault';
import { generatePassword, evaluatePasswordStrength } from '../crypto/passwordUtils';
import { cyberAudio } from '../utils/cyberAudio';
import { copySecureToClipboard } from '../utils/clipboard';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword?: (password: string) => void;
  zIndex?: number;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectPassword,
  zIndex = 1200,
}) => {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    avoidAmbiguous: true,
    mode: 'password',
    wordCount: 4,
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(() => {
    cyberAudio.playKeypress();
    const pwd = generatePassword(options);
    setGeneratedPassword(pwd);
  }, [options]);

  useEffect(() => {
    if (isOpen) {
      regenerate();
      setCopied(false);
    }
  }, [isOpen, regenerate]);

  if (!isOpen) return null;

  const strength = evaluatePasswordStrength(generatedPassword);

  const handleCopy = () => {
    if (!generatedPassword) return;
    copySecureToClipboard(generatedPassword, 45);
    cyberAudio.playCopySound();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseThisPassword = () => {
    if (onSelectPassword && generatedPassword) {
      onSelectPassword(generatedPassword);
      onClose();
    } else {
      handleCopy();
    }
  };

  // Colorize characters for high readability
  const renderFormattedPassword = (pwd: string) => {
    return pwd.split('').map((char, index) => {
      let color = 'var(--cyber-green)';
      if (/[0-9]/.test(char)) color = 'var(--cyber-cyan)';
      else if (/[^a-zA-Z0-9]/.test(char)) color = 'var(--cyber-amber)';
      else if (/[A-Z]/.test(char)) color = '#ffffff';

      return (
        <span key={index} style={{ color, display: 'inline-block' }}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="cyber-modal-backdrop" style={{ zIndex }}>
      <div
        className="cyber-card cyber-corners"
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(255, 255, 255, 0.93)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(14, 165, 233, 0.22)',
          boxShadow: '0 20px 60px -8px rgba(14, 116, 144, 0.22), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--cyber-green)" />
            <h2 style={{ fontSize: '16px', letterSpacing: '0.08em', color: 'var(--cyber-green)' }}>
              KEY // GENERATOR NODE
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

        {/* Mode Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {(['password', 'passphrase', 'pin'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                cyberAudio.playKeypress();
                setOptions({ ...options, mode: m });
              }}
              className="cyber-btn"
              style={{
                background: options.mode === m ? 'var(--cyber-green)' : 'rgba(255,255,255,0.03)',
                color: options.mode === m ? '#000' : 'var(--cyber-text-main)',
                borderColor: options.mode === m ? 'var(--cyber-green)' : 'var(--cyber-border-dim)',
                padding: '6px 10px',
                fontSize: '11px',
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Generated Output Box */}
        <div
          style={{
            position: 'relative',
            background: 'rgba(14, 165, 233, 0.06)',
            border: '1px solid rgba(14, 165, 233, 0.22)',
            padding: '16px',
            marginBottom: '16px',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              letterSpacing: options.mode === 'pin' ? '0.4em' : '0.05em',
            }}
          >
            {renderFormattedPassword(generatedPassword)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={regenerate}
              className="cyber-btn cyber-btn-secondary cyber-btn-icon"
              title="Regenerate"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleCopy}
              className="cyber-btn cyber-btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY'}</span>
            </button>
          </div>
        </div>

        {/* Strength & Entropy Pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(14, 165, 233, 0.06)',
            border: '1px solid rgba(14, 165, 233, 0.18)',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '12px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="var(--cyber-green)" />
            <span style={{ color: 'var(--cyber-green)', fontWeight: 600 }}>
              {strength.label} ({strength.entropy} BITS ENTROPY)
            </span>
          </div>
          <span style={{ color: 'var(--cyber-text-muted)' }}>
            CRACK TIME: {strength.crackTimeDisplay}
          </span>
        </div>

        {/* Sliders and Toggles */}
        {options.mode === 'password' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--cyber-text-muted)' }}>PASSWORD LENGTH</span>
                <span style={{ color: 'var(--cyber-green)', fontWeight: 700 }}>{options.length} CHARS</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={options.length}
                onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--cyber-green)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={options.useUpper}
                  onChange={(e) => setOptions({ ...options, useUpper: e.target.checked })}
                  style={{ accentColor: 'var(--cyber-green)' }}
                />
                <span>Uppercase (A-Z)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={options.useLower}
                  onChange={(e) => setOptions({ ...options, useLower: e.target.checked })}
                  style={{ accentColor: 'var(--cyber-green)' }}
                />
                <span>Lowercase (a-z)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={options.useNumbers}
                  onChange={(e) => setOptions({ ...options, useNumbers: e.target.checked })}
                  style={{ accentColor: 'var(--cyber-green)' }}
                />
                <span>Numbers (0-9)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={options.useSymbols}
                  onChange={(e) => setOptions({ ...options, useSymbols: e.target.checked })}
                  style={{ accentColor: 'var(--cyber-green)' }}
                />
                <span>Symbols (!@#$)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', gridColumn: 'span 2' }}>
                <input
                  type="checkbox"
                  checked={options.avoidAmbiguous}
                  onChange={(e) => setOptions({ ...options, avoidAmbiguous: e.target.checked })}
                  style={{ accentColor: 'var(--cyber-green)' }}
                />
                <span>Avoid ambiguous characters (0, O, 1, l, I)</span>
              </label>
            </div>
          </div>
        )}

        {options.mode === 'passphrase' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--cyber-text-muted)' }}>WORDS COUNT</span>
              <span style={{ color: 'var(--cyber-green)', fontWeight: 700 }}>{options.wordCount || 4} WORDS</span>
            </div>
            <input
              type="range"
              min="3"
              max="8"
              value={options.wordCount || 4}
              onChange={(e) => setOptions({ ...options, wordCount: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--cyber-green)' }}
            />
          </div>
        )}

        {options.mode === 'pin' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--cyber-text-muted)' }}>PIN DIGITS</span>
              <span style={{ color: 'var(--cyber-green)', fontWeight: 700 }}>{options.length} DIGITS</span>
            </div>
            <input
              type="range"
              min="4"
              max="12"
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--cyber-green)' }}
            />
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            className="cyber-btn cyber-btn-secondary"
          >
            CLOSE
          </button>
          {onSelectPassword && (
            <button
              onClick={handleUseThisPassword}
              className="cyber-btn cyber-btn-primary"
            >
              INSERT INTO ITEM
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
