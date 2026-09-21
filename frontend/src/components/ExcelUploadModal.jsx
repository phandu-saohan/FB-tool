import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw,
  Phone,
  Mail,
  User,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { uploadCampaignExcel, downloadEmailExcelTemplate } from '../api';

export default function ExcelUploadModal({ campaignId, campaignName, isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setErrorMsg(null);
      setUploadResult(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
      setUploadResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const res = await downloadEmailExcelTemplate();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mau_danh_sach_email_sdt.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Không thể tải file mẫu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Vui lòng chọn hoặc kéo thả file Excel/CSV trước khi nạp!');
      return;
    }

    try {
      setUploading(true);
      setErrorMsg(null);
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadCampaignExcel(campaignId, formData);
      setUploadResult(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Lỗi khi tải file lên máy chủ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Nhập Danh Sách Từ File Excel (3 Cột)</h3>
              <p className="text-xs text-slate-500">Chiến dịch: <span className="font-semibold text-blue-600">{campaignName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Format Guide Box */}
          <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 text-xs text-emerald-950 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 flex items-center space-x-1.5 text-sm">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Quy chuẩn 3 cột trong file Excel:</span>
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-300 shadow-2xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingTemplate ? 'Đang tải...' : 'Tải File Mẫu Excel (.xlsx)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-medium text-slate-700">
              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs flex flex-col items-center">
                <span className="text-xs text-slate-400 font-mono">Cột 1</span>
                <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                  <User className="w-3 h-3 text-blue-500" />
                  <span>Tên</span>
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Bác sĩ Nguyễn Văn A</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs flex flex-col items-center">
                <span className="text-xs text-slate-400 font-mono">Cột 2</span>
                <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                  <Mail className="w-3 h-3 text-amber-500" />
                  <span>Email</span>
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">nguyenvana@gmail.com</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs flex flex-col items-center">
                <span className="text-xs text-slate-400 font-mono">Cột 3</span>
                <span className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>Số điện thoại</span>
                </span>
                <span className="text-[11px] text-emerald-600 font-medium mt-0.5">0912345678 (Zalo OA)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Hệ thống tự động làm sạch số điện thoại và định dạng sẵn sàng cho việc gửi tin nhắn Zalo OA / ZNS.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
              file 
                ? 'border-emerald-500 bg-emerald-50/20' 
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              file ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Kéo thả file Excel / CSV vào đây hoặc click để chọn file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {file ? `Dung lượng: ${(file.size / 1024).toFixed(1)} KB` : 'Hỗ trợ định dạng .xlsx, .xls, .csv'}
              </p>
            </div>
          </div>

          {/* Result Alert */}
          {uploadResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-1.5 animate-in fade-in">
              <div className="flex items-center space-x-2 font-bold text-emerald-800 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Nạp dữ liệu thành công!</span>
              </div>
              <p>{uploadResult.message}</p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-slate-700">
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-base font-bold text-emerald-600">{uploadResult.imported_count}</div>
                  <div className="text-[11px] text-slate-400">Đã nạp mới</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-base font-bold text-blue-600">{uploadResult.zalo_ready_count}</div>
                  <div className="text-[11px] text-slate-400">Sẵn sàng Zalo OA</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-base font-bold text-slate-500">{uploadResult.skipped_count}</div>
                  <div className="text-[11px] text-slate-400">Email trùng lặp</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
          >
            {uploadResult ? 'Hoàn tất & Đóng' : 'Hủy bỏ'}
          </button>

          {!uploadResult ? (
            <button
              type="button"
              disabled={uploading || !file}
              onClick={handleSubmit}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang đọc và lưu dữ liệu...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xác nhận nạp danh sách</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              Xem danh sách người nhận
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
