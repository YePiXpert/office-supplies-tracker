import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('渲染加粗与行内代码', () => {
    expect(renderMarkdown('这是 **重点** 和 `code`')).toBe(
      '<p>这是 <strong>重点</strong> 和 <code>code</code></p>',
    );
  });

  it('渲染无序与有序列表', () => {
    expect(renderMarkdown('- 甲\n- 乙')).toBe('<ul><li>甲</li><li>乙</li></ul>');
    expect(renderMarkdown('1. 甲\n2、乙')).toBe('<ol><li>甲</li><li>乙</li></ol>');
  });

  it('渲染标题与分段', () => {
    expect(renderMarkdown('## 结论\n\n第一段\n第二行')).toBe(
      '<h2>结论</h2><p>第一段<br>第二行</p>',
    );
  });

  it('渲染表格', () => {
    const html = renderMarkdown('| 月份 | 金额 |\n| --- | ---: |\n| 一月 | 100 |');
    expect(html).toContain('<th>月份</th>');
    expect(html).toContain('<td>100</td>');
  });

  it('围栏代码块只做 HTML 转义，不套 Markdown', () => {
    expect(renderMarkdown('```\n**不解析**\n```')).toBe(
      '<pre><code>**不解析**</code></pre>',
    );
  });

  it('HTML 一律转义，脚本注入只是文本', () => {
    const html = renderMarkdown('<script>alert(1)</script> 和 **加粗**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>加粗</strong>');
  });

  it('链接渲染为新窗口打开', () => {
    expect(renderMarkdown('见 [文档](https://example.com)')).toBe(
      '<p>见 <a href="https://example.com" target="_blank" rel="noreferrer noopener">文档</a></p>',
    );
  });
});
