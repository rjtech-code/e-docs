"""PDF -> XLSX. Detects real tables with pdfplumber (ruled tables first, then a
text-alignment fallback). One sheet per detected table, named "Page N" / "Page N - T2".

Usage: python pdf_to_xlsx.py input.pdf output.xlsx
"""
import re
import sys

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

NUMERIC = re.compile(r"^-?\d+(\.\d+)?$")


def clean(cell):
    if cell is None:
        return ""
    text = " ".join(str(cell).split())
    if NUMERIC.match(text):
        return float(text) if "." in text else int(text)
    return text


def to_rows(table):
    rows = [[clean(c) for c in row] for row in (table or [])]
    return [r for r in rows if any(c != "" for c in r)]


def page_tables(page):
    # 1) ruled tables  2) text-aligned tables  3) plain text lines (split on wide gaps)
    result = [rows for rows in map(to_rows, page.extract_tables()) if rows]
    if result:
        return result

    try:
        rows = to_rows(
            page.extract_table({"vertical_strategy": "text", "horizontal_strategy": "text"})
        )
    except Exception:
        rows = []
    # Text strategy on a plain paragraph page yields one cell per line; only trust it
    # when it actually found several columns.
    if rows and max(len(r) for r in rows) > 1:
        return [rows]

    lines = (page.extract_text() or "").splitlines()
    rows = [[clean(c) for c in re.split(r"\s{2,}|\t", ln.strip())] for ln in lines if ln.strip()]
    return [rows] if rows else []


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: pdf_to_xlsx.py input.pdf output.xlsx")
    src, dst = sys.argv[1], sys.argv[2]

    wb = Workbook()
    wb.remove(wb.active)
    used = set()

    with pdfplumber.open(src) as pdf:
        for number, page in enumerate(pdf.pages, start=1):
            for index, rows in enumerate(page_tables(page), start=1):
                title = f"Page {number}" if index == 1 else f"Page {number} - T{index}"
                title = title[:31]
                while title in used:
                    title = (title[:28] + "_x")[:31]
                used.add(title)
                ws = wb.create_sheet(title)
                for row in rows:
                    ws.append(row)
                for ci in range(1, ws.max_column + 1):
                    longest = max(
                        (len(str(ws.cell(row=ri, column=ci).value or "")) for ri in range(1, ws.max_row + 1)),
                        default=8,
                    )
                    ws.column_dimensions[get_column_letter(ci)].width = min(max(longest + 2, 8), 60)
                for cell in ws[1]:
                    cell.font = Font(bold=True)

    if not wb.sheetnames:
        ws = wb.create_sheet("No tables found")
        ws.append(["No tables or tabular text could be detected in this PDF."])

    wb.save(dst)


if __name__ == "__main__":
    main()
