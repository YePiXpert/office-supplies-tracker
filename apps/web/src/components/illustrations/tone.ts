export type IlluTone = 'blue' | 'teal' | 'amber' | 'red' | 'gray';

export interface IlluColors {
  /** 主强调色（描边、关键图形） */
  main: string;
  /** 柔色打底（背景面板） */
  soft: string;
  /** 深线稿色 */
  ink: string;
}

/**
 * 插画配色一律引用设计令牌的 CSS 变量（见 styles/main.css @theme），
 * 令牌换色时插画自动跟随。
 */
export const toneColors: Record<IlluTone, IlluColors> = {
  blue: { main: 'var(--color-primary)', soft: 'var(--color-primary-soft)', ink: 'var(--color-ink)' },
  teal: { main: 'var(--color-teal)', soft: 'var(--color-teal-soft)', ink: 'var(--color-ink)' },
  amber: { main: 'var(--color-amber)', soft: 'var(--color-amber-soft)', ink: 'var(--color-ink)' },
  red: { main: 'var(--color-red)', soft: 'var(--color-red-soft)', ink: 'var(--color-ink)' },
  gray: { main: 'var(--color-muted)', soft: 'var(--color-canvas)', ink: 'var(--color-ink)' },
};
