"""解析策略类：定义不同文件类型的解析策略与上下文调度。"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from parser.parser_core import DocumentParser


class ParserStrategy:
    def parse(self, parser: "DocumentParser") -> dict:
        raise NotImplementedError


class PDFTableStrategy(ParserStrategy):
    def parse(self, parser: "DocumentParser") -> dict:
        return parser._parse_pdf()


class PDFTextStrategy(PDFTableStrategy):
    pass


class PDFOCRStrategy(ParserStrategy):
    def parse(self, parser: "DocumentParser") -> dict:
        return parser._parse_pdf_via_ocr()


class OCRImageStrategy(ParserStrategy):
    def parse(self, parser: "DocumentParser") -> dict:
        result = parser._parse_image()
        result.setdefault("_parse_mode", "image_ocr")
        return result


class ParserContext:
    def __init__(self, parser: "DocumentParser"):
        self.parser = parser
        self._pdf_text_strategy = PDFTableStrategy()
        self._pdf_ocr_strategy = PDFOCRStrategy()
        self._image_strategy = OCRImageStrategy()

    def parse(self) -> dict:
        if self.parser.file_type == "pdf":
            return self._parse_pdf()
        if self.parser.file_type == "image":
            return self._image_strategy.parse(self.parser)
        raise ValueError(f"不支持的文件类型: {self.parser.file_type}")

    def _parse_pdf(self) -> dict:
        parsed = self._pdf_text_strategy.parse(self.parser)
        if self.parser._should_fallback_pdf_ocr(parsed):
            ocr_parsed = self._pdf_ocr_strategy.parse(self.parser)
            result = self.parser._merge_pdf_and_ocr_result(parsed, ocr_parsed)
            result["_parse_mode"] = "pdf_text+ocr"
            return result
        parsed["_parse_mode"] = "pdf_text"
        return parsed
