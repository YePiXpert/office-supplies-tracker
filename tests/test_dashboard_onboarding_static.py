from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_static(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_dashboard_uses_compact_operational_entry_points():
    html = read_static("static/index.html")

    assert 'class="dashboard-command-strip"' in html
    assert "让每一笔采购都有下文" in html
    assert "新增记录" in html
    assert "导入单据" in html
    assert "打开执行看板" in html
    assert "快捷入口" in html
    assert "数据质检" in html
    assert "switchView('settings')" in html
    assert 'class="dashboard-first-run"' not in html
    assert 'class="dashboard-cycle-chart"' not in html


def test_dashboard_redesign_styles_are_defined():
    css = read_static("static/redesign.css")

    assert ".dashboard-command-strip" in css
    assert ".dashboard-metrics-row" in css
    assert ".dashboard-shortcut-list" in css
    assert "prefers-reduced-motion" in css


def test_dashboard_flow_distribution_uses_live_counts():
    html = read_static("static/index.html")
    state_js = read_static("static/state.js")
    css = read_static("static/redesign.css")

    assert ':style="dashboardStatusDonutStyle"' in html
    assert 'v-for="segment in dashboardStatusDistribution"' in html
    assert "dashboardStatusDistribution()" in state_js
    assert "dashboardStatusDonutStyle()" in state_js
    assert "segment.count / total" in state_js
    assert "--dashboard-donut-background" in css
    assert "0 28%" not in css
