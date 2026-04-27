import pytest
from import_flow import (
    FULLWIDTH_TRANSLATION,
    build_preview_data,
    collect_duplicates,
    is_noise_item_name,
    item_key,
    normalize_import_payload,
    normalize_request_date,
    normalize_serial_number,
    normalize_text,
    normalize_url,
    safe_quantity,
    safe_unit_price,
    validate_import_header_fields,
)


class TestNormalizeText:
    def test_fullwidth_conversion(self):
        assert normalize_text("１２３", 10) == "123"
        assert normalize_text("：／．", 10) == ":/."

    def test_whitespace_collapse(self):
        assert normalize_text("hello   world", 20) == "hello world"

    def test_length_truncation(self):
        assert normalize_text("abcdefghij", 5) == "abcde"


class TestNormalizeSerialNumber:
    def test_uppercase_and_no_spaces(self):
        assert normalize_serial_number("ab 123") == "AB123"
        assert normalize_serial_number("  cd-456  ") == "CD-456"


class TestNormalizeRequestDate:
    def test_canonical(self):
        assert normalize_request_date("2024-01-15") == "2024-01-15"

    def test_chinese_format(self):
        assert normalize_request_date("2024年1月15日") == "2024-01-15"

    def test_slash_format(self):
        assert normalize_request_date("2024/1/15") == "2024-01-15"

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            normalize_request_date("not a date")

    def test_invalid_date_raises(self):
        with pytest.raises(ValueError):
            normalize_request_date("2024-02-30")


class TestNormalizeUrl:
    def test_valid_https(self):
        assert normalize_url("https://example.com/item") == "https://example.com/item"

    def test_www_prefix_added(self):
        result = normalize_url("www.example.com")
        assert result == "https://www.example.com"

    def test_blank_returns_none(self):
        assert normalize_url("") is None
        assert normalize_url("   ") is None

    def test_invalid_returns_none(self):
        assert normalize_url("just a string") is None


class TestIsNoiseItemName:
    def test_valid_names(self):
        assert not is_noise_item_name("签字笔")
        assert not is_noise_item_name("A4纸")

    def test_header_combos(self):
        assert is_noise_item_name("序号物品名称")
        assert is_noise_item_name("序号 数量 备注")

    def test_empty_or_hash(self):
        assert is_noise_item_name("")
        assert is_noise_item_name("###")


class TestItemKey:
    def test_tuple_key(self):
        item = {"serial_number": "S001", "item_name": "笔", "handler": "张三"}
        assert item_key(item) == ("S001", "笔", "张三")


class TestSafeQuantity:
    def test_numeric(self):
        assert safe_quantity(5) == 5.0
        assert safe_quantity(3.5) == 3.5

    def test_string_with_digits(self):
        assert safe_quantity("10个") == 10.0

    def test_zero_fallback(self):
        with pytest.raises(ValueError):
            safe_quantity(0)
        with pytest.raises(ValueError):
            safe_quantity(-1)

    def test_invalid_fallback(self):
        with pytest.raises(ValueError):
            safe_quantity("abc")


class TestSafeUnitPrice:
    def test_numeric(self):
        assert safe_unit_price(10.5) == 10.5

    def test_negative_returns_none(self):
        assert safe_unit_price(-5) is None

    def test_none(self):
        assert safe_unit_price(None) is None

    def test_currency_symbols(self):
        assert safe_unit_price("¥25.5") == 25.5


class TestNormalizeImportPayload:
    def test_basic_fields(self):
        result = normalize_import_payload({
            "serial_number": "AB-001",
            "department": "研发部",
            "handler": "张三",
            "request_date": "2024-03-15",
            "items": [
                {
                    "item_name": "签字笔",
                    "quantity": 10,
                    "unit_price": 2.5,
                }
            ],
        })
        assert result["serial_number"] == "AB-001"
        assert result["department"] == "研发部"
        assert result["handler"] == "张三"
        assert result["request_date"] == "2024-03-15"
        assert len(result["items"]) == 1
        assert result["items"][0]["item_name"] == "签字笔"
        assert result["items"][0]["quantity"] == 10
        assert result["items"][0]["unit_price"] == 2.5

    def test_merges_duplicate_keys(self):
        result = normalize_import_payload({
            "serial_number": "AB-002",
            "department": "研发部",
            "handler": "张三",
            "request_date": "2024-03-15",
            "items": [
                {"item_name": "笔", "quantity": 5},
                {"item_name": "笔", "quantity": 3},
            ],
        })
        assert len(result["items"]) == 1
        assert result["items"][0]["quantity"] == 8

    def test_filters_noise_items(self):
        result = normalize_import_payload({
            "serial_number": "AB-003",
            "department": "研发部",
            "handler": "李四",
            "request_date": "2024-03-15",
            "items": [
                {"item_name": "序号物品名称数量"},
                {"item_name": "签字笔", "quantity": 2},
            ],
        })
        assert len(result["items"]) == 1
        assert result["items"][0]["item_name"] == "签字笔"


class TestBuildPreviewData:
    def test_standard_output(self):
        payload = {
            "serial_number": "S001",
            "department": "研发部",
            "handler": "张三",
            "request_date": "2024-01-01",
        }
        items = [{"item_name": "笔", "quantity": 5, "purchase_link": None, "unit_price": 2.0, "supplier_id": None}]
        result = build_preview_data(payload, items)
        assert result["serial_number"] == "S001"
        assert result["items"][0]["item_name"] == "笔"
        assert result["items"][0]["quantity"] == 5


class TestCollectDuplicates:
    def test_finds_duplicates(self):
        items = [
            {
                "serial_number": "S001",
                "item_name": "笔",
                "handler": "张三",
                "department": "研发部",
                "quantity": 5,
            }
        ]
        existing = {("S001", "笔", "张三"): {"id": 1, "quantity": 3}}
        result = collect_duplicates(items, existing)
        assert len(result) == 1
        assert result[0]["existing_quantity"] == 3
        assert result[0]["new_quantity"] == 5

    def test_no_duplicates(self):
        items = [
            {
                "serial_number": "S002",
                "item_name": "纸",
                "handler": "李四",
                "department": "研发部",
                "quantity": 1,
            }
        ]
        existing = {}
        assert collect_duplicates(items, existing) == []


class TestValidateImportHeaderFields:
    def test_valid_passes(self):
        validate_import_header_fields({
            "serial_number": "S001",
            "department": "研发部",
            "handler": "张三",
            "request_date": "2024-01-15",
            "items": [],
        })

    def test_missing_raises(self):
        import fastapi
        with pytest.raises(fastapi.HTTPException):
            validate_import_header_fields({
                "serial_number": "",
                "department": "研发部",
                "handler": "",
                "request_date": "",
                "items": [],
            })
