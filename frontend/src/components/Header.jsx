import React, { useState } from 'react';
import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Power, 
  RefreshCw,
  ShieldAlert,
  KeyRound,
  X,
  HelpCircle,
  Check,
  ClipboardPaste
} from 'lucide-react';
import { openManualLogin, stopBrowser, checkLoginStatus, importCookies } from '../api';

export default function Header({ browserStatus, onRefreshStatus }) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [importingCookie, setImportingCookie] = useState(false);
  const [cookieMsg, setCookieMsg] = useState(null);

  const handleOpenLogin = async () => {
    try {
      setLoadingAction(true);
      await openManualLogin();
      await onRefreshStatus();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStopBrowser = async () => {
    try {
      setLoadingAction(true);
      await stopBrowser();
      await onRefreshStatus();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckLogin = async () => {
    try {
      setLoadingAction(true);
      await checkLoginStatus();
      await onRefreshStatus();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleImportCookies = async () => {
    if (!cookieInput.trim()) {
      alert('Vui lòng dán cookie vào khung trước!');
      return;
    }
    try {
      setImportingCookie(true);
      setCookieMsg(null);
      const res = await importCookies(cookieInput);
      setCookieMsg({
        type: res.data.success ? 'success' : 'warning',
        text: res.data.message
      });
      await onRefreshStatus();
      if (res.data.success) {
        setTimeout(() => {
          setShowCookieModal(false);
          setCookieInput('');
          setCookieMsg(null);
        }, 2000);
      }
    } catch (err) {
      setCookieMsg({
        type: 'error',
        text: err.response?.data?.detail || err.message
      });
    } finally {
      setImportingCookie(false);
    }
  };

  const getStatusBadge = () => {
    if (browserStatus.checkpoint_detected) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-red-600" />
          YÊU CẦU XÁC MINH (CHECKPOINT)
        </span>
      );
    }

    if (browserStatus.is_logged_in) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
          ĐÃ ĐĂNG NHẬP FACEBOOK
        </span>
      );
    }

    if (browserStatus.login_status === 'WAITING_FOR_MANUAL_LOGIN') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
          CHỜ ĐĂNG NHẬP THỦ CÔNG
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <Power className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
        CHƯA KHỞI CHẠY TRÌNH DUYỆT
      </span>
    );
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Left status badge */}
        <div className="flex items-center space-x-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái Session:</div>
          {getStatusBadge()}
        </div>

        {/* Right control buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCheckLogin}
            disabled={loadingAction}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 shadow-2xs transition disabled:opacity-50"
            title="Kiểm tra lại trạng thái đăng nhập"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
            <span>Kiểm tra</span>
          </button>

          {/* VPS / Dokploy Cookie Importer button */}
          <button
            onClick={() => {
              setShowCookieModal(true);
              setCookieMsg(null);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
            title="Đăng nhập Facebook bằng Cookie (khuyên dùng khi chạy trên VPS/Dokploy)"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Nạp Cookie (Đăng nhập VPS)</span>
          </button>

          <button
            onClick={handleOpenLogin}
            disabled={loadingAction}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50"
            title="Mở trình duyệt trực tiếp (chỉ hoạt động khi chạy trên máy tính nội bộ có màn hình)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở Facebook đăng nhập</span>
          </button>

          {browserStatus.is_running && (
            <button
              onClick={handleStopBrowser}
              disabled={loadingAction}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Dừng Trình duyệt</span>
            </button>
          )}
        </div>
      </header>

      {/* Modal Nạp Cookie cho VPS/Dokploy */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Đăng nhập Facebook bằng Cookie (VPS / Dokploy)</h3>
                  <p className="text-xs text-slate-500">Dành riêng cho Dokploy hoặc máy chủ không có giao diện màn hình</p>
                </div>
              </div>
              <button
                onClick={() => setShowCookieModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Instructions Callout */}
              <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3.5 text-xs text-blue-900 space-y-2 leading-relaxed">
                <div className="font-semibold flex items-center space-x-1.5 text-blue-800">
                  <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Tại sao không mở được trình duyệt trực tiếp?</span>
                </div>
                <p className="text-slate-600">
                  Dokploy chạy ứng dụng trên máy chủ Linux VPS (chế độ Headless, không có màn hình vật lý). Do đó cửa sổ Chrome không thể hiển thị trên máy tính của bạn.
                </p>
                <div className="pt-1 border-t border-blue-200/50">
                  <span className="font-semibold text-blue-800">Cách lấy Cookie 10 giây:</span>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-600">
                    <li>Cài tiện ích <strong>Cookie-Editor</strong> trên Chrome/Edge của bạn.</li>
                    <li>Mở tab <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">facebook.com</span> đã đăng nhập tài khoản.</li>
                    <li>Bấm vào biểu tượng <strong>Cookie-Editor</strong> &gt; Bấm <strong>Export</strong> &gt; Chọn <strong>Export as JSON</strong> (hoặc Header String).</li>
                    <li>Dán toàn bộ nội dung đã copy vào khung bên dưới rồi bấm <strong>Nạp Cookie</strong>.</li>
                  </ol>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dán Cookie Facebook (JSON hoặc chuỗi text <code className="text-slate-500 font-mono">c_user=...; xs=...</code>):
                </label>
                <textarea
                  rows={6}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder='Dán nội dung JSON từ Cookie-Editor (ví dụ: [{"name": "c_user", "value": "1000..."}, ...]) hoặc chuỗi cookie dạng "c_user=...; xs=..." vào đây'
                  className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition"
                />
              </div>

              {/* Feedback messages */}
              {cookieMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium border flex items-start space-x-2 ${
                  cookieMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  cookieMsg.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                  'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {cookieMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> :
                   <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                  <span>{cookieMsg.text}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowCookieModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={importingCookie || !cookieInput.trim()}
                onClick={handleImportCookies}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {importingCookie ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xác thực và lưu session...</span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Nạp Cookie & Đăng nhập</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

