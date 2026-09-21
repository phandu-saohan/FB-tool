import unittest
import io
import openpyxl
from app.services.email.excel_service import ExcelContactService
from app.database.models import EmailCampaignRecipient


class TestExcelZaloService(unittest.TestCase):
    def test_normalize_phone(self):
        self.assertEqual(ExcelContactService.normalize_phone("0912 345 678"), "0912345678")
        self.assertEqual(ExcelContactService.normalize_phone("+84912345678"), "0912345678")
        self.assertEqual(ExcelContactService.normalize_phone("84912345678"), "0912345678")
        self.assertEqual(ExcelContactService.normalize_phone("0912.345.678"), "0912345678")
        self.assertEqual(ExcelContactService.normalize_phone("0912-345-678"), "0912345678")
        self.assertIsNone(ExcelContactService.normalize_phone("invalid"))

    def test_to_zalo_oa_format(self):
        self.assertEqual(ExcelContactService.to_zalo_oa_format("0912345678"), "84912345678")
        self.assertEqual(ExcelContactService.to_zalo_oa_format("+84912345678"), "84912345678")
        self.assertEqual(ExcelContactService.to_zalo_oa_format("0987654321"), "84987654321")

    def test_sample_template_generation(self):
        buf = ExcelContactService.generate_sample_template()
        self.assertGreater(buf.getbuffer().nbytes, 100)
        wb = openpyxl.load_workbook(buf)
        ws = wb.active
        self.assertEqual(ws.cell(row=1, column=1).value, "Tên")
        self.assertEqual(ws.cell(row=1, column=2).value, "Email")
        self.assertEqual(ws.cell(row=1, column=3).value, "Số điện thoại")

    def test_parse_excel_file(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Tên", "Email", "Số điện thoại"])
        ws.append(["Nguyễn Văn A", "a@test.com", "0912345678"])
        ws.append(["Trần Thị B", "b@test.com", "+84988888888"])
        ws.append(["Lê C", "invalid-email", "0900000000"])  # invalid email
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        valid, errors = ExcelContactService.parse_contacts_file(buf.getvalue(), "test.xlsx")
        self.assertEqual(len(valid), 2)
        self.assertEqual(len(errors), 1)
        self.assertEqual(valid[0]["email"], "a@test.com")
        self.assertEqual(valid[0]["phone"], "0912345678")
        self.assertEqual(valid[1]["phone"], "0988888888")

    def test_export_zalo_oa(self):
        r1 = EmailCampaignRecipient(id=1, email="a@test.com", name="A", phone="0912345678")
        r2 = EmailCampaignRecipient(id=2, email="b@test.com", name="B", phone="0988888888")
        buf = ExcelContactService.export_zalo_oa_contacts("Campaign 1", [r1, r2])
        self.assertGreater(buf.getbuffer().nbytes, 100)
        wb = openpyxl.load_workbook(buf)
        ws = wb.active
        self.assertEqual(ws.cell(row=2, column=2).value, "84912345678")
        self.assertEqual(ws.cell(row=3, column=2).value, "84988888888")


if __name__ == "__main__":
    unittest.main()
