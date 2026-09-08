import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';

/**
 * 图表配色与坐标轴基础样式（与设计令牌对齐）。
 * ECharts 画在 canvas 上读不到 CSS 变量，必须运行时解析成具体颜色；
 * 主题切换后通过 useChartTheme() 的 computed 重新取色。
 */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface ChartTheme {
  colors: string[];
  axis: {
    axisLine: { lineStyle: { color: string } };
    axisLabel: { color: string; fontSize: number };
    axisTick: { show: boolean };
  };
  /** 网格分割线颜色（yAxis.splitLine 等） */
  splitLine: string;
  /** 卡片表面色：饼图扇区间描边等需要「看起来像卡片底」的场景 */
  surface: string;
  /** 次要文字色（图例等） */
  muted: string;
  tooltip: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    textStyle: { color: string; fontSize: number };
    extraCssText: string;
  };
}

export function getChartTheme(): ChartTheme {
  return {
    colors: [
      token('--color-primary'),
      token('--color-teal'),
      token('--color-amber'),
      token('--color-red'),
      token('--color-muted'),
      token('--color-faint'),
    ],
    axis: {
      axisLine: { lineStyle: { color: token('--color-line-strong') } },
      axisLabel: { color: token('--color-muted'), fontSize: 11 },
      axisTick: { show: false },
    },
    splitLine: token('--color-line'),
    surface: token('--color-surface'),
    muted: token('--color-muted'),
    tooltip: {
      backgroundColor: token('--color-surface'),
      borderColor: token('--color-line'),
      borderWidth: 1,
      textStyle: { color: token('--color-text'), fontSize: 12 },
      // tooltip 是 HTML 元素，阴影直接用令牌变量，主题切换不用重建
      extraCssText: 'box-shadow: var(--shadow-pop); border-radius: 10px;',
    },
  };
}

/** 响应式图表主题：主题翻转时自动重新取色，option computed 引用它即可联动 */
export function useChartTheme() {
  const theme = useThemeStore();
  return computed<ChartTheme>(() => {
    void theme.resolved;
    return getChartTheme();
  });
}
