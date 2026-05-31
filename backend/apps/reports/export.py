"""Report export — CSV, PDF, XLSX, ZIP."""
from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime
from typing import Any

from django.core.files.base import ContentFile


def _safe_str(v: Any) -> str:
    if v is None:
        return ''
    return str(v)


def export_csv(headers: list[str], rows: list[list[Any]]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([_safe_str(c) for c in row])
    return buf.getvalue().encode('utf-8-sig')


def export_xlsx(headers: list[str], rows: list[list[Any]], sheet_name: str = 'Report') -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]
    ws.append(headers)
    for row in rows:
        ws.append([_safe_str(c) for c in row])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_pdf(title: str, headers: list[str], rows: list[list[Any]], meta: dict | None = None) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), title=title)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(title, styles['Title']),
        Spacer(1, 8),
    ]
    if meta:
        for k, v in meta.items():
            story.append(Paragraph(f'<b>{k}:</b> {_safe_str(v)}', styles['Normal']))
        story.append(Spacer(1, 12))

    data = [headers] + [[_safe_str(c) for c in row] for row in rows[:500]]
    if len(rows) > 500:
        data.append(['…'] * len(headers))
        data.append([f'(Truncated — {len(rows)} total rows)'] + [''] * (len(headers) - 1))

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        f'Generated {datetime.now().strftime("%Y-%m-%d %H:%M")} · LR-Ride Financial Reports · Confidential',
        styles['Normal'],
    ))
    doc.build(story)
    return buf.getvalue()


def export_zip(files: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, content in files:
            zf.writestr(name, content)
    return buf.getvalue()


def build_file_content(
    fmt: str,
    title: str,
    headers: list[str],
    rows: list[list[Any]],
    meta: dict | None = None,
) -> tuple[bytes, str]:
    meta = meta or {}
    if fmt == 'csv':
        return export_csv(headers, rows), 'text/csv'
    if fmt == 'xlsx':
        return export_xlsx(headers, rows, title[:31]), (
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    if fmt == 'pdf':
        return export_pdf(title, headers, rows, meta), 'application/pdf'
    if fmt == 'zip':
        inner = export_csv(headers, rows)
        return export_zip([(f'{title.replace(" ", "_")}.csv', inner)]), 'application/zip'
    return export_csv(headers, rows), 'text/csv'


def save_report_file(run, content: bytes, ext: str):
    filename = f'{run.report_key}_{run.id.hex[:8]}.{ext}'
    run.file.save(filename, ContentFile(content), save=False)
    run.file_size = len(content)
