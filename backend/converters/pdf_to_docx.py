"""PDF -> DOCX using pdf2docx (keeps layout, tables, images and fonts far better
than rebuilding text line by line).

Usage: python pdf_to_docx.py input.pdf output.docx
"""
import sys

from pdf2docx import Converter


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: pdf_to_docx.py input.pdf output.docx")
    src, dst = sys.argv[1], sys.argv[2]
    cv = Converter(src)
    try:
        cv.convert(dst)
    finally:
        cv.close()


if __name__ == "__main__":
    main()
