import React from 'react';
import { X, ShieldAlert, AlertTriangle, CopyCheck, KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';
import type { VaultItem } from '../types/vault';
import { performSecurityAudit } from '../crypto/passwordUtils';
import { cyberAudio } from '../utils/cyberAudio';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VaultItem[];
  onSelectItem: (item: VaultItem) => void;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectItem,
}) => {
  if (!isOpen) return null;

  const audit = performSecurityAudit(items);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--cyber-green)';
    if (score >= 50) return 'var(--cyber-amber)';
    return 'var(--cyber-red)';
  };

  return (
    <div className="cyber-modal-backdrop">
      <div
        className="cyber-card cyber-corners"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} color={getScoreColor(audit.overallScore)} />
            <h2 style={{ fontSize: '16px', letterSpacing: '0.08em', color: getScoreColor(audit.overallScore) }}>
              SECURITY AUDIT // BREACH DEFENSE REPORT
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

        {/* Content Scrollable */}
        <div style={{ overflowY: 'auto', paddingRight: '6px' }}>
          {/* Top Score Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              background: 'rgba(14, 165, 233, 0.06)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              borderRadius: '10px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--cyber-text-muted)', letterSpacing: '0.1em' }}>
                OVERALL VAULT DEFENSE RATING
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  color: getScoreColor(audit.overallScore),
                  lineHeight: 1.1,
                  marginTop: '4px',
                }}
              >
                {audit.overallScore} / 100
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cyber-text-dim)', marginTop: '4px' }}>
                {audit.overallScore >= 80
                  ? 'High defense posture. Most credentials resist brute force.'
                  : audit.overallScore >= 50
                  ? 'Moderate risk detected. Action recommended on reused or weak passwords.'
                  : 'Critical vulnerabilities present! Upgrade flagged credentials immediately.'}
              </div>
            </div>

            {/* Micro Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'right' }}>
              <div className="cyber-badge cyber-badge-green">
                <ShieldCheck size={12} />
                <span>{audit.safeCount} SAFE</span>
              </div>
              <div className="cyber-badge cyber-badge-amber">
                <CopyCheck size={12} />
                <span>{audit.reusedCount} REUSED</span>
              </div>
              <div className="cyber-badge cyber-badge-red">
                <AlertTriangle size={12} />
                <span>{audit.weakCount} WEAK</span>
              </div>
              <div className="cyber-badge cyber-badge-cyan">
                <KeyRound size={12} />
                <span>{audit.missing2FACount} NO 2FA</span>
              </div>
            </div>
          </div>

          {/* Section: Reused Passwords */}
          {audit.reusedGroups.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cyber-amber)',
                  marginBottom: '10px',
                }}
              >
                <AlertTriangle size={16} />
                <span>REUSED CREDENTIALS DETECTED ({audit.reusedGroups.length} GROUPS)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {audit.reusedGroups.map((group, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(217, 119, 6, 0.07)',
                      border: '1px solid rgba(217, 119, 6, 0.25)',
                      padding: '12px',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--cyber-amber)', fontWeight: 600 }}>
                        Shared Hash: {group.passwordSnippet}
                      </span>
                      <span className="cyber-badge cyber-badge-amber">{group.count} ACCOUNTS REUSED</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {group.itemIds.map((id) => {
                        const item = items.find((i) => i.id === id);
                        if (!item) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              cyberAudio.playKeypress();
                              onSelectItem(item);
                              onClose();
                            }}
                            className="cyber-btn cyber-btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            <span>{item.title}</span>
                            <ArrowRight size={10} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Weak Passwords */}
          {audit.weakItemIds.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cyber-red)',
                  marginBottom: '10px',
                }}
              >
                <AlertTriangle size={16} />
                <span>CRITICALLY WEAK PASSWORDS ({audit.weakItemIds.length} ITEMS)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {audit.weakItemIds.map((id) => {
                  const item = items.find((i) => i.id === id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(225, 29, 72, 0.06)',
                        border: '1px solid rgba(225, 29, 72, 0.2)',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cyber-text-main)' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--cyber-text-dim)' }}>
                          Username: {item.username || 'N/A'}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          cyberAudio.playKeypress();
                          onSelectItem(item);
                          onClose();
                        }}
                        className="cyber-btn cyber-btn-danger"
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                      >
                        UPGRADE NOW
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* If everything is clean */}
          {audit.reusedGroups.length === 0 && audit.weakItemIds.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'rgba(13, 148, 136, 0.06)',
                border: '1px solid rgba(13, 148, 136, 0.2)',
                borderRadius: '12px',
              }}
            >
              <ShieldCheck size={48} color="var(--cyber-green)" style={{ marginBottom: '12px' }} />
              <div className="font-display" style={{ fontSize: '16px', color: 'var(--cyber-green)', marginBottom: '6px' }}>
                ALL PASSWORDS PASS SECURITY CRITERIA
              </div>
              <p style={{ fontSize: '12px', color: 'var(--cyber-text-muted)' }}>
                No duplicate passwords, zero weak credentials, and resilient cryptographic entropy detected.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--cyber-border-dim)' }}>
          <button onClick={onClose} className="cyber-btn cyber-btn-primary">
            DISMISS REPORT
          </button>
        </div>
      </div>
    </div>
  );
};
