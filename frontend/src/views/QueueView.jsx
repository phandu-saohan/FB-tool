import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  Pause, 
  Play, 
  StopCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  RotateCw
} from 'lucide-react';
import { getQueueStatus, pauseQueue, resumeQueue, cancelQueue, openManualLogin } from '../api';

export default function QueueView() {
  const [queue, setQueue] = useState({
    status: 'IDLE',
    current_post_id: null,
    total_in_queue: 0,
    completed: 0,
    failed: 0,
    countdown_remaining: 0,
    message: 'Đang tải...'
  });
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await getQueueStatus();
      setQueue(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePause = async () => {
    setLoadingAction(true);
    try {
      await pauseQueue();
      await fetchQueue();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResume = async () => {
    setLoadingAction(true);
    try {
      await resumeQueue();
      await fetchQueue();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Bạn có chắc muốn hủy tiến trình đăng bài đang chạy?')) return;
    setLoadingAction(true);
    try {
      await cancelQueue();
      await fetchQueue();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const progressPercent = queue.total_in_queue > 0 
    ? Math.round(((queue.completed + queue.failed) / queue.total_in_queue) * 100) 
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hàng đợi Tự động hóa (Automation Queue)</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý và giám sát tiến độ đăng bài tuần tự, an toàn.</p>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center space-x-3">
          {queue.status === 'RUNNING' && (
            <button
              onClick={handlePause}
              disabled={loadingAction}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl shadow transition"
            >
              <Pause className="w-4 h-4" />
              <span>Tạm dừng (Pause)</span>
            </button>
          )}

          {(queue.status === 'PAUSED' || queue.status === 'ACTION_REQUIRED') && (
            <button
              onClick={handleResume}
              disabled={loadingAction}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow transition"
            >
              <Play className="w-4 h-4" />
              <span>Tiếp tục (Resume)</span>
            </button>
          )}

          {(queue.status === 'RUNNING' || queue.status === 'PAUSED' || queue.status === 'ACTION_REQUIRED') && (
            <button
              onClick={handleCancel}
              disabled={loadingAction}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl shadow transition"
            >
              <StopCircle className="w-4 h-4" />
              <span>Hủy (Cancel)</span>
            </button>
          )}
        </div>
      </div>

      {/* Checkpoint / Action Required Banner */}
      {queue.status === 'ACTION_REQUIRED' && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 space-y-3 shadow-2xs">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">
              Facebook requires manual verification. Please complete verification in the browser.
            </h3>
          </div>
          <p className="text-sm text-red-700 leading-relaxed">
            Phát hiện Checkpoint hoặc CAPTCHA bảo mật từ Facebook. Toàn bộ tác vụ tự động đã được dừng tạm thời.
            Hệ thống <b>không tự động bypass CAPTCHA hay checkpoint</b> để đảm bảo an toàn tuyệt đối cho tài khoản.
          </p>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={openManualLogin}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl shadow transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mở Trình duyệt để xác minh</span>
            </button>
            <button
              onClick={handleResume}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 shadow-2xs transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Đã xác minh xong, tiếp tục</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Status Display */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái hiện tại</div>
            <div className="text-2xl font-black text-slate-900 mt-1 flex items-center space-x-3">
              <span>{queue.status}</span>
              {queue.status === 'RUNNING' && <span className="w-3 h-3 rounded-full bg-blue-600 animate-ping" />}
            </div>
          </div>

          {queue.countdown_remaining > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center space-x-3">
              <Clock className="w-5 h-5 text-amber-600 animate-spin" />
              <div>
                <div className="text-[11px] text-amber-800 font-semibold uppercase">Giãn cách an toàn</div>
                <div className="text-sm font-bold text-amber-900">Còn {queue.countdown_remaining} giây...</div>
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-mono">
          &gt; {queue.message}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-2 font-semibold">
            <span>Tiến độ tổng thể</span>
            <span className="text-slate-800">{queue.completed + queue.failed} / {queue.total_in_queue} mục tiêu ({progressPercent}%)</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs text-slate-500 font-semibold">Tổng số mục tiêu</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{queue.total_in_queue}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="text-xs text-emerald-700 font-semibold">Thành công</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{queue.completed}</div>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
            <div className="text-xs text-rose-700 font-semibold">Thất bại</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{queue.failed}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
