import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Pagination from './Pagination.vue';

describe('Pagination', () => {
  it('渲染总数与页码', () => {
    const wrapper = mount(Pagination, { props: { page: 1, pageSize: 20, total: 85 } });
    expect(wrapper.text()).toContain('共 85 条');
    // 85 / 20 = 5 页，页数 ≤ 7 全部展示
    const buttons = wrapper.findAll('button').filter((b) => /^\d+$/.test(b.text()));
    expect(buttons).toHaveLength(5);
  });

  it('页数多时折叠为省略号', () => {
    const wrapper = mount(Pagination, { props: { page: 10, pageSize: 20, total: 500 } });
    expect(wrapper.text()).toContain('…');
  });

  it('点击页码触发 change 事件', async () => {
    const wrapper = mount(Pagination, { props: { page: 1, pageSize: 20, total: 40 } });
    await wrapper.findAll('button').find((b) => b.text() === '2')!.trigger('click');
    expect(wrapper.emitted('change')?.[0]).toEqual([2]);
  });
});
