import type React from 'react'

/**
 * Global design tokens shared across all modules.
 * Travel module's `T` extends these for module-specific tokens.
 */

// --- Color Palette ---
export const colors = {
  // Primary: warm orange
  primary: '#F5722D',
  primaryHover: '#FF8C4A',
  primaryBg: '#FFF7E6',
  primaryLight: '#FFD8BF',
  primaryDark: '#D4500A',

  // Accent: blue (routes, links, secondary actions)
  accent: '#2563EB',
  accentBg: '#EFF6FF',

  // Semantic
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',

  // Neutrals
  text: '#1a1a1a',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  bg: '#F9FAFB',
  bgElevated: '#FFFFFF',

  // Special
  gold: '#D48806',
  purple: '#8B5CF6',
  pink: '#EC4899',
}

// --- Gradients ---
export const gradients = {
  primary: 'linear-gradient(135deg, #F5722D, #FF9A5C)',
  primaryLight: 'linear-gradient(135deg, #FFF7E6, #FFE8D5)',
  primarySubtle: 'linear-gradient(135deg, rgba(245,114,45,0.06), rgba(245,114,45,0.12))',
  hero: 'linear-gradient(135deg, #F5722D 0%, #FF6B35 50%, #FF9A5C 100%)',
  sidebar: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)',
  page: 'linear-gradient(135deg, #FEFEFE 0%, #FFF9F5 50%, #FEFEFE 100%)',
}

// --- Shadows ---
export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.06)',
  md: '0 4px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  lg: '0 8px 32px rgba(0,0,0,0.08)',
  primary: `0 4px 16px rgba(245,114,45,0.2)`,
  primaryStrong: `0 6px 24px rgba(245,114,45,0.3)`,
  card: '0 2px 12px rgba(0,0,0,0.04), 0 0.5px 2px rgba(0,0,0,0.03)',
  cardHover: '0 8px 28px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
  insetGlow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
}

// --- Glassmorphism ---
export const glass = {
  panel: {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: `${shadows.lg}, ${shadows.insetGlow}`,
  } as React.CSSProperties,

  card: {
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(12px) saturate(160%)',
    WebkitBackdropFilter: 'blur(12px) saturate(160%)',
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: shadows.card,
    borderRadius: 16,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties,

  cardHover: {
    boxShadow: `${shadows.cardHover}, 0 0 0 1px rgba(245,114,45,0.1)`,
    transform: 'translateY(-2px)',
  } as React.CSSProperties,

  button: {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: `${shadows.sm}, ${shadows.insetGlow}`,
    borderRadius: 12,
  } as React.CSSProperties,
}

// --- Ant Design theme override ---
export const antThemeToken = {
  colorPrimary: colors.primary,
  colorLink: colors.accent,
  borderRadius: 10,
  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  colorBgLayout: '#F7F7F8',
  colorBgContainer: '#FFFFFF',
}
