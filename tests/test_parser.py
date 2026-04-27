import os
import tempfile

import pytest

from parser import DocumentParser, parse_document


def _make_parser(text: str = "", tables: list = None) -> DocumentParser:
    """创建用于单元测试的 DocumentParser 实例。"""
    parser = DocumentParser.__new__(DocumentParser)
    parser.text = text
    parser.tables = tables or []
    return parser


@pytest.fixture
def sample_text_pdf() -> str:
    """Create a minimal text PDF with valid header content for testing extractions."""
    pdf_content = """%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 200>>
stream
BT
/F1 12 Tf
72 700 Td (流程号: AB-20240001) Tj
0 -20 Td (经办人: 张三) Tj
0 -20 Td (申领部门: 研发部) Tj
0 -20 Td (日期: 2024-03-15) Tj
0 -30 Td (物品名称 数量 单价) Tj
0 -20 Td (签字笔 10 2.50) Tj
0 -20 Td (A4纸 5 20.00) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000279 00000 n 
0000000531 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
621
%%EOF"""
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        f.write(pdf_content)
    yield path
    try:
        os.unlink(path)
    except OSError:
        pass


class TestParserBasic:
    def test_file_type_detection_pdf(self, sample_text_pdf):
        parser = DocumentParser(sample_text_pdf)
        assert parser.file_type == "pdf"

    def test_file_type_detection_image(self, tmp_path):
        img_path = tmp_path / "test.png"
        img_path.touch()
        parser = DocumentParser(str(img_path))
        assert parser.file_type == "image"

    def test_file_type_unknown(self, tmp_path):
        path = tmp_path / "test.doc"
        path.touch()
        parser = DocumentParser(str(path))
        assert parser.file_type == "unknown"

    def test_empty_result_structure(self):
        parser = DocumentParser.__new__(DocumentParser)
        result = parser._get_empty_result()
        assert result["serial_number"] == ""
        assert result["department"] == ""
        assert result["handler"] == ""
        assert result["request_date"] == ""
        assert result["items"] == []


class TestHeaderExtraction:
    def test_extract_serial_number_from_text(self):
        parser = _make_parser("流水号: AB-20240001\n经办人: 张三")
        info = parser._extract_header_info()
        assert info["serial_number"] == "AB-20240001"

    def test_extract_request_date(self):
        parser = _make_parser("日期: 2024年03月15日\n经办人: 张三")
        info = parser._extract_header_info()
        assert info["request_date"] == "2024-03-15"

    def test_extract_handler(self):
        parser = _make_parser("经办人: 张三\n部门: 研发部")
        info = parser._extract_header_info()
        assert info["handler"] == "张三"


class TestDepartmentExtraction:
    def test_clean_department_text(self):
        parser = _make_parser()
        result = parser._clean_department_text("申领部门: 研发部")
        assert result == "研发部"

    def test_clean_department_removes_opinion_fields(self):
        parser = _make_parser()
        result = parser._clean_department_text("申领部门: 研发部 部门领导意见: 同意")
        assert result == "研发部"

    def test_looks_like_department(self):
        parser = _make_parser()
        assert parser._looks_like_department("研发部")
        assert parser._looks_like_department("综合管理办公室")
        assert not parser._looks_like_department("张三")
        assert not parser._looks_like_department("2024-03-15")
        assert not parser._looks_like_department("123")


class TestSkipLogic:
    def test_skip_keywords(self):
        parser = _make_parser()
        for kw in ["总金额", "合计", "部门领导", "管理员意见", "审批"]:
            assert parser._should_skip_row(kw, "") is True

    def test_not_skip_valid_item(self):
        parser = _make_parser()
        assert parser._should_skip_row("签字笔", "") is False

    def test_should_fallback_ocr(self):
        parser = _make_parser()
        parser.text = "short"
        parsed = {
            "serial_number": "",
            "department": "",
            "handler": "",
            "request_date": "",
            "items": [],
        }
        assert parser._should_fallback_pdf_ocr(parsed) is True

    def test_should_not_fallback_with_dept_and_items(self):
        parser = _make_parser()
        parser.text = "this is a sufficiently long text to pass minimum length check"
        parsed = {
            "serial_number": "",
            "department": "研发部",
            "handler": "张三",
            "request_date": "",
            "items": [{"item_name": "笔", "quantity": 1}],
        }
        assert parser._should_fallback_pdf_ocr(parsed) is False


class TestItemExtraction:
    def test_find_header_row(self):
        parser = _make_parser()
        table = [
            ["申领部门", "研发部"],
            ["序号", "物品名称", "数量", "单价"],
            ["1", "签字笔", "10", "2.50"],
        ]
        assert parser._find_header_row(table) == 1

    def test_find_column_mapping(self):
        parser = _make_parser()
        header = ["序号", "物品名称", "数量", "单价", "备注"]
        mapping = parser._find_column_mapping(header)
        assert mapping["serial"] == 0
        assert mapping["item_name"] == 1
        assert mapping["quantity"] == 2
        assert mapping["unit_price"] == 3
        assert mapping["remark"] == 4

    def test_parse_table_row(self):
        parser = _make_parser()
        row = ["1", "签字笔", "10", "2.50", ""]
        mapping = {"serial": 0, "item_name": 1, "quantity": 2, "unit_price": 3, "remark": 4}
        item = parser._parse_table_row(row, mapping)
        assert item is not None
        assert item["item_name"] == "签字笔"
        assert item["quantity"] == 10


class TestCleanItemName:
    def test_normal(self):
        parser = _make_parser()
        assert parser._clean_item_name("签字笔") == "签字笔"

    def test_whitespace(self):
        parser = _make_parser()
        assert parser._clean_item_name("  签字笔  ") == "签字笔"


class TestParseDocument:
    def test_parse_empty_pdf(self, tmp_path):
        """验证真实 __init__ 流程（最低限度集成测试）。"""
        from io import BytesIO
        pdf_path = tmp_path / "empty.pdf"
        pdf_content = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF"
        pdf_path.write_bytes(pdf_content)
        parser = DocumentParser(str(pdf_path))
        assert parser.file_type == "pdf"
        result = parser.parse()
        assert "items" in result
