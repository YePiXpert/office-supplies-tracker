import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from './StatusBadge.vue';

describe('StatusBadge', () => {
  it('已知状态映射中文标签', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'PENDING_PURCHASE' } });
    expect(wrapper.text()).toBe('待采购');
  });

  it('未知状态原样显示', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'WHATEVER' } });
    expect(wrapper.text()).toBe('WHATEVER');
  });
});
