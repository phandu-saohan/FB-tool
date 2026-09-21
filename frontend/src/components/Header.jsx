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
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
          YÊU CẦU XÁC MINH (CHECKPOINT)
        </span>
      );
    }

    if (browserStatus.is_logged_in) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          ĐÃ ĐĂNG NHẬP FACEBOOK
        </span>
      );
    }

    if (browserStatus.login_status === 'WAITING_FOR_MANUAL_LOGIN') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          CHỜ ĐĂNG NHẬP THỦ CÔNG
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
        <Power className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
        CHƯA KHỞI CHẠY TRÌNH DUYỆT
      </span>
    );
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
      {/* Left status badge */}
      <div className="flex items-center space-x-3">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Trạng thái Session:</div>
        {getStatusBadge()}
      </div>

      {/* Right control buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={handleCheckLogin}
          disabled={loadingAction}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
          title="Kiểm tra lại trạng thái đăng nhập"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
          <span>Kiểm tra</span>
        </button>

        <button
          onClick={handleOpenLogin}
          disabled={loadingAction}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Mở Facebook đăng nhập</span>
        </button>

        {browserStatus.is_running && (
          <button
            onClick={handleStopBrowser}
            disabled={loadingAction}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium rounded-lg border border-rose-500/30 transition disabled:opacity-50"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Dừng Trình duyệt</span>
          </button>
        )}
      </div>
    </header>
  );
}
