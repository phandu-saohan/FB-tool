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
    def parse_contacts_file(cls, file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Optional[str]]], List[str]]:
        """
        Parses an uploaded .xlsx or .csv file into a list of contacts with keys:
        - name: str
        - email: str
        - phone: str
        Returns (contacts, errors)
        """
        lower_name = filename.lower()
        rows_data = []

        if lower_name.endswith('.csv'):
            # Try utf-8-sig first (handles Excel BOM), fallback to utf-8, then latin1
            for enc in ['utf-8-sig', 'utf-8', 'cp1252', 'latin1']:
                try:
                    text_data = file_bytes.decode(enc)
                    reader = csv.reader(io.StringIO(text_data))
                    rows_data = [row for row in reader if any(cell.strip() for cell in row)]
                    break
                except UnicodeDecodeError:
                    continue
        else:
            # Excel file (.xlsx, .xls)
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            ws = wb.active
            for row in ws.iter_rows(values_only=True):
                # Filter out completely empty rows
                if row and any(cell is not None and str(cell).strip() != '' for cell in row):
                    rows_data.append([str(c).strip() if c is not None else '' for c in row])

        if not rows_data:
            return [], ["File rỗng hoặc không có dữ liệu hợp lệ."]

        # Detect headers
        header_row = rows_data[0]
        name_idx, email_idx, phone_idx = -1, -1, -1

        for idx, col in enumerate(header_row):
            col_clean = str(col).lower().replace('_', ' ').replace('-', ' ').strip()
            # Email detection
            if any(k in col_clean for k in ['email', 'mail', 'thư điện tử']):
                if email_idx == -1:
                    email_idx = idx
            # Phone detection
            elif any(k in col_clean for k in ['số điện thoại', 'sđt', 'sdt', 'phone', 'điện thoại', 'mobile', 'tel']):
                if phone_idx == -1:
                    phone_idx = idx
            # Name detection
            elif any(k in col_clean for k in ['tên', 'họ tên', 'họ và tên', 'name', 'full name', 'khách hàng', 'người nhận']):
                if name_idx == -1:
                    name_idx = idx

        start_row = 1
        # If headers couldn't be detected with certainty, assume default: Col 0=Name, Col 1=Email, Col 2=Phone
        if email_idx == -1:
            # Check if first row is actually data
            if '@' in str(header_row[1] if len(header_row) > 1 else ''):
                name_idx, email_idx, phone_idx = 0, 1, 2
                start_row = 0
            elif '@' in str(header_row[0]):
                name_idx, email_idx, phone_idx = 1, 0, 2
                start_row = 0
            else:
                name_idx = 0
                email_idx = 1
                phone_idx = 2
                start_row = 1

        contacts = []
        errors = []

        for row_idx in range(start_row, len(rows_data)):
            row = rows_data[row_idx]
            name = str(row[name_idx]).strip() if 0 <= name_idx < len(row) else ''
            raw_email = str(row[email_idx]).strip() if 0 <= email_idx < len(row) else ''
            raw_phone = str(row[phone_idx]).strip() if 0 <= phone_idx < len(row) else ''

            clean_email = raw_email.lower().strip()
            if not clean_email or '@' not in clean_email:
                errors.append(f"Dòng {row_idx + 1}: Bỏ qua do email '{raw_email}' không hợp lệ.")
                continue

            normalized_phone = cls.normalize_phone(raw_phone)

            contacts.append({
                "name": name if name else None,
                "email": clean_email,
                "phone": normalized_phone,
                "zalo_phone": cls.to_zalo_oa_format(normalized_phone)
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
