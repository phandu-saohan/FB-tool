import { Terminal, RefreshCw, Trash2, ArrowDownCircle } from 'lucide-react';
import { getLogs } from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(false);
  const logContainerRef = useRef(null);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await getLogs(300);
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLogs = filterLevel === 'ALL' 
    ? logs 
    : logs.filter(l => l.level === filterLevel);

  const {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    setCurrentPage,
    setPageSize
  } = usePagination(filteredLogs, 30);

  const getLevelColor = (level) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-emerald-400 font-bold';
      case 'WARNING':
        return 'text-amber-400 font-bold';
      case 'ERROR':
        return 'text-rose-400 font-bold';
      default:
        return 'text-blue-400 font-medium';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Nhật ký Hệ thống (Live Logs)</h2>
          <p className="text-slate-400 text-sm mt-1">Theo dõi hoạt động tự động hóa và thông báo lỗi theo thời gian thực.</p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none"
          >
            <option value="ALL">Tất cả mức độ (ALL)</option>
            <option value="INFO">Chỉ [INFO]</option>
            <option value="SUCCESS">Chỉ [SUCCESS]</option>
            <option value="WARNING">Chỉ [WARNING]</option>
            <option value="ERROR">Chỉ [ERROR]</option>
          </select>

          <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-600"
            />
            <span>Tự cuộn xuống</span>
          </label>

          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-2xl overflow-hidden flex flex-col h-[600px]">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80 mb-3 px-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-slate-500 text-[11px] ml-2">automation.log — Live Console Buffer</span>
        </div>

        <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-1.5 px-2">
          {totalItems === 0 ? (
            <div className="text-slate-600 py-12 text-center">Chưa có nhật ký nào được ghi nhận.</div>
          ) : (
            paginatedItems.map((item, i) => (
              <div key={i} className="flex items-start space-x-2 leading-relaxed hover:bg-slate-900/50 px-1 rounded transition">
                <span className="text-slate-500 select-none shrink-0">{item.created_at}</span>
                <span className={`shrink-0 ${getLevelColor(item.level)}`}>[{item.level}]</span>
                {item.action && (
                  <span className="text-purple-400 shrink-0 font-medium">[{item.action}]</span>
                )}
                <span className="text-slate-300 break-all">{item.message}</span>
              </div>
            ))
          )}
        </div>

        <Pagination
          totalItems={totalItems}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[20, 30, 50, 100]}
          darkMode={true}
          className="rounded-b-xl border-t border-slate-800"
        />
      </div>
    </div>
  );
}

