export type ThemeId = 'classic-ios' | 'sakura-pink' | 'cyber';

export interface AppThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  cardBorderActive: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentBorder: string;
  secondaryButtonBg: string;
  secondaryButtonText: string;
  secondaryButtonBorder: string;
  destructiveButtonBg: string;
  destructiveButtonText: string;
  destructiveButtonBorder: string;
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  inputText: string;
  inputPlaceholder: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  divider: string;
  badgeBg: string;
  badgeText: string;
}

export interface AppTheme {
  id: ThemeId;
  name: string;
  subtitle: string;
  isDark: boolean;
  isMono: boolean;
  isUppercase: boolean;
  borderRadius: number;
  colors: AppThemeColors;
}
