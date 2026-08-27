/** 图表配色与坐标轴基础样式（与设计令牌对齐） */
export const CHART_COLORS = ['#2563EB', '#0F766E', '#B45309', '#C24141', '#14213D', '#64748B'];

export const AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#DFE5ED' } },
  axisLabel: { color: '#526078', fontSize: 11 },
  axisTick: { show: false },
} as const;

export const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DFE5ED',
  borderWidth: 1,
  textStyle: { color: '#172033', fontSize: 12 },
  extraCssText: 'box-shadow: 0 8px 24px rgba(20,33,61,.12); border-radius: 8px;',
} as const;
