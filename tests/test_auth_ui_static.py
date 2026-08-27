from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_static(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_auth_gate_renders_polished_security_layout():
    html = read_static("static/index.html")

    assert 'class="auth-shell"' in html
    assert 'class="auth-brand-panel"' in html
    assert 'class="auth-form-panel"' in html
    assert 'class="auth-product-mark"' in html
    assert "<h1>采购进度清楚" in html
    assert "采购进度清楚" in html
    assert "数据留在自己手里" in html
    assert "本地数据" in html
    assert "安全访问" in html
    assert "随时可恢复" in html
    assert 'autocomplete="current-password"' in html
    assert 'autocomplete="new-password"' in html


def test_auth_gate_styles_are_defined():
    css = read_static("static/redesign.css")

    assert ".auth-shell" in css
    assert ".auth-brand-panel" in css
    assert ".auth-security-list" in css
    assert ".auth-form-panel" in css
    assert ".auth-field" in css
