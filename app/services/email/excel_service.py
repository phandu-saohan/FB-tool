import io
import re
import csv
from typing import List, Dict, Tuple, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

class ExcelContactService:
    @staticmethod
    def normalize_phone(raw_phone: Optional[str]) -> Optional[str]:
        """
        Cleans and normalizes Vietnamese phone numbers.
        Examples:
          '+84 912 345 678' -> '0912345678'
          '84912345678'     -> '0912345678'
          '0912-345-678'    -> '0912345678'
          '0912.345.678'    -> '0912345678'
        """
        if not raw_phone:
            return None
        # Remove non-digits
        digits = re.sub(r'\D', '', str(raw_phone))
        if not digits:
            return None

        # Convert +84 or 84 to 0
        if digits.startswith('84') and len(digits) >= 11:
            digits = '0' + digits[2:]
        elif not digits.startswith('0') and len(digits) == 9:
            digits = '0' + digits

        # Valid Vietnamese phone numbers are typically 10 digits starting with 03, 05, 07, 08, 09
        if len(digits) == 10 and digits.startswith('0'):
            return digits
        
        # If 9 to 11 digits, return digits as cleaned string
        if 9 <= len(digits) <= 11:
            return digits
        return digits if digits else None

    @staticmethod
    def to_zalo_oa_format(phone: Optional[str]) -> Optional[str]:
        """
        Converts phone number to Zalo OA / ZNS international standard: 84xxxxxxxxx
        """
        if not phone:
            return None
        cleaned = re.sub(r'\D', '', str(phone))
        if cleaned.startswith('0') and len(cleaned) == 10:
            return '84' + cleaned[1:]
        if cleaned.startswith('84'):
            return cleaned
        return cleaned

    @classmethod
    def _detect_csv_delimiter(cls, sample_text: str) -> str:
        """Detects CSV delimiter (, ; \t |) based on frequency and consistency."""
        lines = [line.strip() for line in sample_text.splitlines() if line.strip()][:10]
        if not lines:
            return ','
        delimiters = [',', ';', '\t', '|']
        best_delim = ','
        max_cols = 0
        for d in delimiters:
            counts = [len(l.split(d)) for l in lines]
            avg_cols = sum(counts) / len(counts)
            # Must split into at least 2 columns and be relatively consistent
            if avg_cols > 1.5 and avg_cols > max_cols:
                max_cols = avg_cols
                best_delim = d
        return best_delim

    @classmethod
    def parse_contacts_file(cls, file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Optional[str]]], List[str]]:
        """
        Parses an uploaded .xlsx, .xls, or .csv file into a list of contacts with keys:
        - name: str
        - email: str
        - phone: str
        - zalo_phone: str
        Returns (contacts, errors)
        
        Features:
        - Auto-detects headers across the first 15 rows (handles banner titles, logo rows).
        - Auto-detects CSV delimiters (comma, semicolon, tab, pipe) & encodings (utf-8, cp1258, etc.).
        - Resilient cell scanning: even if column order varies (e.g. Email-Name-Phone or STT-Name-Phone-Email),
          it automatically identifies email and phone cells using regex.
        - Gracefully skips blank/summary rows without generating false errors.
        """
        if not file_bytes or len(file_bytes) == 0:
            return [], ["Tệp tải lên rỗng hoặc không có dữ liệu."]

        lower_name = filename.lower()
        rows_data = []

        # Check for legacy binary .xls (BIFF format)
        if file_bytes.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
            return [], [
                "Định dạng file .xls (Excel 97-2003) cũ không được hỗ trợ trực tiếp. "
                "Vui lòng mở file trong Excel và chọn 'Save As' sang định dạng .xlsx hoặc .csv rồi thử lại."
            ]

        # Determine if it's CSV or Excel
        is_csv = lower_name.endswith('.csv')
        # If filename doesn't say .csv, but file is not a zip (xlsx is a zip starting with PK\x03\x04)
        if not is_csv and not file_bytes.startswith(b'PK\x03\x04'):
            # Could be a CSV named .xlsx or plain text
            is_csv = True

        if is_csv:
            for enc in ['utf-8-sig', 'utf-8', 'cp1258', 'cp1252', 'latin1']:
                try:
                    text_data = file_bytes.decode(enc)
                    delim = cls._detect_csv_delimiter(text_data)
                    reader = csv.reader(io.StringIO(text_data), delimiter=delim)
                    rows_data = [
                        [str(cell).strip() for cell in row]
                        for row in reader
                        if any(str(cell).strip() for cell in row)
                    ]
                    if rows_data:
                        break
                except UnicodeDecodeError:
                    continue
        else:
            try:
                wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                # Look for the first sheet with data
                target_sheet = wb.active
                for sheet in wb.worksheets:
                    if sheet.max_row and sheet.max_row > 0 and sheet.max_column and sheet.max_column > 0:
                        # Check if has content
                        sheet_rows = list(sheet.iter_rows(values_only=True, max_row=10))
                        if any(any(c is not None and str(c).strip() != '' for c in r) for r in sheet_rows):
                            target_sheet = sheet
                            break

                for row in target_sheet.iter_rows(values_only=True):
                    if row and any(cell is not None and str(cell).strip() != '' for cell in row):
                        rows_data.append([str(c).strip() if c is not None else '' for c in row])
            except Exception as e:
                # Fallback: if openpyxl failed, try CSV reading in case user uploaded CSV disguised as xlsx
                try:
                    text_data = file_bytes.decode('utf-8', errors='ignore')
                    delim = cls._detect_csv_delimiter(text_data)
                    reader = csv.reader(io.StringIO(text_data), delimiter=delim)
                    rows_data = [
                        [str(cell).strip() for cell in row]
                        for row in reader
                        if any(str(cell).strip() for cell in row)
                    ]
                except Exception:
                    return [], [f"Không thể đọc file Excel/CSV: {str(e)}"]

        if not rows_data:
            return [], ["Tệp Excel/CSV không có dữ liệu hợp lệ hoặc bảng tính đang rỗng."]

        # Smart Header Scanning across first 15 rows
        email_regex = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
        best_header_row_idx = -1
        name_idx, email_idx, phone_idx = -1, -1, -1
        highest_score = 0

        scan_limit = min(15, len(rows_data))
        for r_idx in range(scan_limit):
            row = rows_data[r_idx]
            score = 0
            temp_name_idx, temp_email_idx, temp_phone_idx = -1, -1, -1

            for c_idx, cell in enumerate(row):
                val = str(cell).lower().replace('_', ' ').replace('-', ' ').strip()
                if not val:
                    continue

                # Email column match
                if any(k in val for k in ['email', 'mail', 'thư điện tử', 'e mail', 'gmail', 'địa chỉ thư']):
                    temp_email_idx = c_idx
                    score += 5
                # Phone column match
                elif any(k in val for k in ['số điện thoại', 'sđt', 'sdt', 'phone', 'điện thoại', 'di động', 'mobile', 'tel', 'zalo', 'hotline']):
                    temp_phone_idx = c_idx
                    score += 3
                # Name column match
                elif any(k in val for k in ['họ và tên', 'họ tên', 'tên', 'họ & tên', 'khách hàng', 'name', 'full name', 'fullname', 'người nhận', 'chủ tài khoản', 'đối tác']):
                    temp_name_idx = c_idx
                    score += 3

            # If this row contains actual email address in data, it is likely data, not a pure header!
            row_has_raw_email = any(email_regex.search(str(c)) for c in row)
            if row_has_raw_email and score < 5:
                # This row is data, do not treat as header
                continue

            if score > highest_score:
                highest_score = score
                best_header_row_idx = r_idx
                name_idx, email_idx, phone_idx = temp_name_idx, temp_email_idx, temp_phone_idx

        # If a header row was detected, data starts after it.
        # If no header was detected, data starts at row 0.
        if best_header_row_idx >= 0 and highest_score >= 3:
            start_row = best_header_row_idx + 1
        else:
            start_row = 0
            # If no header, check if first row matches default column layout (Name, Email, Phone) or (Email, Name, Phone)
            sample_row = rows_data[0]
            for c_idx, cell in enumerate(sample_row):
                if email_regex.search(str(cell)):
                    email_idx = c_idx
                    break
            if email_idx == 1:
                name_idx = 0
                phone_idx = 2 if len(sample_row) > 2 else -1
            elif email_idx == 0:
                name_idx = 1 if len(sample_row) > 1 else -1
                phone_idx = 2 if len(sample_row) > 2 else -1
            else:
                email_idx = -1

        contacts = []
        errors = []
        seen_emails = set()

        for row_idx in range(start_row, len(rows_data)):
            row = rows_data[row_idx]
            # Ignore empty row
            if not any(str(c).strip() for c in row):
                continue

            # Check if this row looks like a summary/footer row (e.g. "Tổng cộng", "Total")
            joined_row = " ".join(str(c).lower() for c in row)
            if any(k in joined_row for k in ['tổng cộng', 'tổng số', 'total', 'page ', 'trang ']) and not email_regex.search(joined_row):
                continue

            # 1. Detect Email in this row
            detected_email = None
            detected_email_col = -1

            # First priority: check designated email_idx
            if 0 <= email_idx < len(row):
                m = email_regex.search(str(row[email_idx]))
                if m:
                    detected_email = m.group(0).lower().strip()
                    detected_email_col = email_idx

            # Second priority: scan all cells in the row for an email
            if not detected_email:
                for c_idx, cell in enumerate(row):
                    m = email_regex.search(str(cell))
                    if m:
                        detected_email = m.group(0).lower().strip()
                        detected_email_col = c_idx
                        break

            if not detected_email:
                errors.append(f"Dòng {row_idx + 1}: Không tìm thấy địa chỉ email hợp lệ.")
                continue

            # 2. Detect Phone in this row
            detected_phone = None
            detected_phone_col = -1

            # Check designated phone_idx first
            if 0 <= phone_idx < len(row) and phone_idx != detected_email_col:
                p_norm = cls.normalize_phone(str(row[phone_idx]))
                if p_norm:
                    detected_phone = p_norm
                    detected_phone_col = phone_idx

            # Otherwise, scan remaining cells for phone number
            if not detected_phone:
                for c_idx, cell in enumerate(row):
                    if c_idx == detected_email_col:
                        continue
                    p_norm = cls.normalize_phone(str(cell))
                    if p_norm:
                        detected_phone = p_norm
                        detected_phone_col = c_idx
                        break

            # 3. Detect Name in this row
            detected_name = ""
            # Check designated name_idx first
            if 0 <= name_idx < len(row) and name_idx not in (detected_email_col, detected_phone_col):
                val = str(row[name_idx]).strip()
                # Ensure it's not a pure number (like an STT index 1, 2, 3)
                if val and not val.isdigit() and len(val) > 1:
                    detected_name = val

            # Otherwise, find the best remaining text cell
            if not detected_name:
                for c_idx, cell in enumerate(row):
                    if c_idx in (detected_email_col, detected_phone_col):
                        continue
                    val = str(cell).strip()
                    # Skip pure digits (STT, IDs) or trivial 1-char tokens
                    if val and not val.isdigit() and len(val) > 1 and not email_regex.search(val):
                        detected_name = val
                        break

            if detected_email in seen_emails:
                # Duplicate within this file, skip
                continue
            seen_emails.add(detected_email)

            contacts.append({
                "name": detected_name if detected_name else None,
                "email": detected_email,
                "phone": detected_phone,
                "zalo_phone": cls.to_zalo_oa_format(detected_phone)
            })

        return contacts, errors


    @classmethod
    def generate_sample_template(cls) -> io.BytesIO:
        """
        Creates a beautifully styled sample Excel file with 3 columns:
        Tên | Email | Số điện thoại
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Danh sách liên hệ"

        # Headers
        headers = ["Tên", "Email", "Số điện thoại"]
        ws.append(headers)

        # Header styling (Blue theme)
        header_fill = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")

        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        for col_num in range(1, 4):
            cell = ws.cell(row=1, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        # Sample rows
        sample_rows = [
            ["Bác sĩ Nguyễn Văn A", "nguyenvana@gmail.com", "0912345678"],
            ["ThS. Trần Thị Mai", "tranthimai@outlook.com", "0987654321"],
            ["Dr. Lê Hoàng Cường", "cuong.le@medicalcenter.vn", "0903112233"],
            ["Công ty Dược Phẩm Á Châu", "info@achaupharm.com", "0934567890"],
            ["Dược sĩ Phạm Thu Hà", "phanthuha@clinic.vn", "0868999888"]
        ]

        data_font = Font(name="Arial", size=10)
        for r_idx, row in enumerate(sample_rows, start=2):
            ws.append(row)
            for c_idx in range(1, 4):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.font = data_font
                cell.border = thin_border
                cell.alignment = left_align if c_idx <= 2 else center_align

        # Column widths
        ws.column_dimensions['A'].width = 30
        ws.column_dimensions['B'].width = 32
        ws.column_dimensions['C'].width = 20

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @classmethod
    def export_zalo_oa_contacts(cls, campaign_name: str, recipients: list) -> io.BytesIO:
        """
        Exports campaign recipients into a specialized Excel format ready for Zalo OA Broadcast & ZNS.
        Includes: STT, Số điện thoại Zalo (84xxxxxxxxx), Họ và tên, Email, Trạng thái Zalo OA
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Zalo OA Contacts"

        # Headers
        headers = [
            "STT",
            "Số điện thoại Zalo (Chuẩn 84)",
            "Số điện thoại gốc",
            "Họ và tên",
            "Email",
            "Trạng thái Email",
            "Trạng thái Zalo OA"
        ]
        ws.append(headers)

        header_fill = PatternFill(start_color="0068FF", end_color="0068FF", fill_type="solid") # Zalo Blue
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")

        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        data_font = Font(name="Arial", size=10)
        stt = 1
        for r in recipients:
            phone_raw = getattr(r, 'phone', None)
            zalo_phone = cls.to_zalo_oa_format(phone_raw)
            if not zalo_phone:
                continue

            row_data = [
                stt,
                zalo_phone,
                phone_raw or '',
                getattr(r, 'name', '') or '',
                getattr(r, 'email', '') or '',
                getattr(r, 'status', 'QUEUED'),
                "Sẵn sàng gửi Zalo OA"
            ]
            ws.append(row_data)

            for col_num in range(1, len(headers) + 1):
                cell = ws.cell(row=stt + 1, column=col_num)
                cell.font = data_font
                cell.border = thin_border
                if col_num in [1, 2, 3, 6, 7]:
                    cell.alignment = center_align
                else:
                    cell.alignment = left_align

            stt += 1

        # Column widths
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 30
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 28
        ws.column_dimensions['E'].width = 32
        ws.column_dimensions['F'].width = 18
        ws.column_dimensions['G'].width = 24

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output
