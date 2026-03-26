import type React from 'react'

/**
 * Global design tokens shared across all modules.
 * Travel module's `T` extends these for module-specific tokens.
 */

// --- Color Palette (Light) ---
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

// --- Gradients (Light) ---
export const gradients = {
  primary: 'linear-gradient(135deg, #F5722D, #FF9A5C)',
  primaryLight: 'linear-gradient(135deg, #FFF7E6, #FFE8D5)',
  primarySubtle: 'linear-gradient(135deg, rgba(245,114,45,0.06), rgba(245,114,45,0.12))',
  hero: 'linear-gradient(135deg, #F5722D 0%, #FF6B35 50%, #FF9A5C 100%)',
  sidebar: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)',
  page: 'linear-gradient(135deg, #FEFEFE 0%, #FFF9F5 50%, #FEFEFE 100%)',
}

// --- Shadows (Light) ---
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

// --- Glassmorphism (Light) ---
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

// --- Ant Design theme override (Light) ---
export const antThemeToken = {
  colorPrimary: colors.primary,
  colorLink: colors.accent,
  borderRadius: 10,
  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  colorBgLayout: '#F7F7F8',
  colorBgContainer: '#FFFFFF',
}

// ============================================================
// Dark Mode Tokens
// ============================================================

// --- Color Palette (Dark) ---
export const darkColors = {
  // Primary: warm orange (same hue, adjusted for dark bg)
  primary: '#F5722D',
  primaryHover: '#FF8C4A',
  primaryBg: '#2A1A0E',
  primaryLight: '#5C3A20',
  primaryDark: '#FF8C4A',

  // Accent: blue
  accent: '#3B82F6',
  accentBg: '#0A1A2A',

  // Semantic
  success: '#34D399',
  successBg: '#0A2A1A',
  warning: '#FBBF24',
  warningBg: '#2A2008',
  danger: '#F87171',
  dangerBg: '#2A0A0A',

  // Neutrals
  text: '#E8E8E8',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B7280',
  border: '#303030',
  borderLight: '#252525',
  bg: '#141414',
  bgElevated: '#1C1C1C',

  // Special
  gold: '#FAAD14',
  purple: '#A78BFA',
  pink: '#F472B6',
}

// --- Gradients (Dark) ---
export const darkGradients = {
  primary: 'linear-gradient(135deg, #F5722D, #FF9A5C)',
  primaryLight: 'linear-gradient(135deg, #2A1A0E, #3D2515)',
  primarySubtle: 'linear-gradient(135deg, rgba(245,114,45,0.08), rgba(245,114,45,0.16))',
  hero: 'linear-gradient(135deg, #F5722D 0%, #FF6B35 50%, #FF9A5C 100%)',
  sidebar: 'linear-gradient(180deg, #1A1A1A 0%, #141414 100%)',
  page: 'linear-gradient(135deg, #141414 0%, #1A1410 50%, #141414 100%)',
}

// --- Shadows (Dark) ---
export const darkShadows = {
  sm: '0 1px 3px rgba(0,0,0,0.20)',
  md: '0 4px 16px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.16)',
  lg: '0 8px 32px rgba(0,0,0,0.28)',
  primary: '0 4px 16px rgba(245,114,45,0.25)',
  primaryStrong: '0 6px 24px rgba(245,114,45,0.35)',
  card: '0 2px 12px rgba(0,0,0,0.16), 0 0.5px 2px rgba(0,0,0,0.12)',
  cardHover: '0 8px 28px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.16)',
  insetGlow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

// --- Glassmorphism (Dark) ---
export const darkGlass = {
  panel: {
    background: 'rgba(30,30,30,0.78)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(60,60,60,0.5)',
    boxShadow: `${darkShadows.lg}, ${darkShadows.insetGlow}`,
  } as React.CSSProperties,

  card: {
    background: 'rgba(30,30,30,0.88)',
    backdropFilter: 'blur(12px) saturate(160%)',
    WebkitBackdropFilter: 'blur(12px) saturate(160%)',
    border: '1px solid rgba(60,60,60,0.6)',
    boxShadow: darkShadows.card,
    borderRadius: 16,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties,

  cardHover: {
    boxShadow: `${darkShadows.cardHover}, 0 0 0 1px rgba(245,114,45,0.15)`,
    transform: 'translateY(-2px)',
  } as React.CSSProperties,

  button: {
    background: 'rgba(30,30,30,0.9)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(60,60,60,0.6)',
    boxShadow: `${darkShadows.sm}, ${darkShadows.insetGlow}`,
    borderRadius: 12,
  } as React.CSSProperties,
}

// --- Ant Design theme override (Dark) ---
export const darkAntThemeToken = {
  colorPrimary: darkColors.primary,
  colorLink: darkColors.accent,
  borderRadius: 10,
  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  colorBgLayout: '#141414',
  colorBgContainer: '#1C1C1C',
}
