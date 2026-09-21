import React, { useState } from 'react';
import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Power, 
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { openManualLogin, stopBrowser, checkLoginStatus } from '../api';

export default function Header({ browserStatus, onRefreshStatus }) {
  const [loadingAction, setLoadingAction] = useState(false);

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

        <button
          onClick={handleOpenLogin}
          disabled={loadingAction}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50"
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
  );
}
