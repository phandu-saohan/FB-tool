import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  ExternalLink, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  RefreshCw,
  PenSquare
} from 'lucide-react';
import { getPages, updatePage, deletePage, selectAllPages } from '../api';

export default function PagesView({ setActiveTab }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywordFilter, setKeywordFilter] = useState('');

  useEffect(() => {
    loadPages();
  }, [keywordFilter]);

  const loadPages = async () => {
    try {
      setLoading(true);
      const res = await getPages({
        keyword: keywordFilter || undefined,
      });
      setPages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = async (page) => {
    try {
      const nextVal = !page.selected;
      await updatePage(page.id, { selected: nextVal });
      setPages(pages.map(p => p.id === page.id ? { ...p, selected: nextVal } : p));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleSelectAll = async (selected) => {
    try {
      await selectAllPages(selected);
      setPages(pages.map(p => ({ ...p, selected })));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa trang này khỏi danh sách?')) return;
    try {
      await deletePage(id);
      setPages(pages.filter(p => p.id !== id));
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const selectedCount = pages.filter(p => p.selected).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Facebook Pages</h2>
          <p className="text-slate-400 text-sm mt-1">Danh sách các trang đã thu thập từ tìm kiếm.</p>
        </div>

        <button
          onClick={() => setActiveTab('create-post')}
          disabled={selectedCount === 0}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium shadow transition"
        >
          <PenSquare className="w-4 h-4" />
          <span>Đăng bài lên {selectedCount} trang đã chọn</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Lọc theo tên trang hoặc từ khóa..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={loadPages}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleSelectAll(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Chọn tất cả</span>
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Bỏ chọn tất cả</span>
          </button>
          <span className="text-xs text-slate-400">
            Đã chọn: <b className="text-white">{selectedCount}</b> / {pages.length}
          </span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4 w-12 text-center">Chọn</th>
                <th className="p-4">Tên trang</th>
                <th className="p-4">Người theo dõi</th>
                <th className="p-4">Danh mục</th>
                <th className="p-4">Từ khóa</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    {loading ? 'Đang tải danh sách trang...' : 'Chưa có trang nào. Hãy vào mục "Tìm kiếm" để tìm các trang mới.'}
                  </td>
                </tr>
              ) : (
                pages.map((pg) => (
                  <tr key={pg.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={pg.selected}
                        onChange={() => handleToggleSelect(pg)}
                        className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-semibold text-white max-w-sm truncate" title={pg.name}>
                      {pg.name}
                    </td>
                    <td className="p-4 text-slate-400">{pg.followers || 'N/A'}</td>
                    <td className="p-4 text-slate-400">{pg.category || 'Page'}</td>
                    <td className="p-4 text-xs text-blue-400">{pg.keyword || '—'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {pg.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-3">
                      <a
                        href={pg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        <span>Mở FB</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => handleDelete(pg.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Xóa trang"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
