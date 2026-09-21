import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export default function Pagination({
  totalItems = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  darkMode = true,
  className = ''
}) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  const startItem = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(validCurrentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validCurrentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (validCurrentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const handlePageClick = (page) => {
    if (page === '...' || page === validCurrentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  if (totalItems <= 0) return null;

  const containerBg = darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600';
  const btnBorder = darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700';
  const activeBtnClass = 'bg-blue-600 text-white font-bold border-blue-600';
  const selectBg = darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700';

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t text-xs font-medium select-none ${containerBg} ${className}`}>
      {/* Left side: showing X - Y of Z and page size selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Hiển thị <strong className={darkMode ? 'text-white' : 'text-slate-900'}>{startItem}</strong> - <strong className={darkMode ? 'text-white' : 'text-slate-900'}>{endItem}</strong> trong tổng số <strong className={darkMode ? 'text-white' : 'text-slate-900'}>{totalItems}</strong> mục
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px] text-slate-400">Số mục/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                if (onPageChange) onPageChange(1);
              }}
              className={`py-1 px-2 rounded-lg border text-xs outline-none transition cursor-pointer ${selectBg}`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: navigation buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => handlePageClick(1)}
          disabled={validCurrentPage === 1}
          className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${btnBorder}`}
          title="Trang đầu"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => handlePageClick(validCurrentPage - 1)}
          disabled={validCurrentPage === 1}
          className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${btnBorder}`}
          title="Trang trước"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Numbered Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((num, idx) => (
            num === '...' ? (
              <span key={`dots-${idx}`} className="px-1.5 py-1 text-slate-500">...</span>
            ) : (
              <button
                key={num}
                onClick={() => handlePageClick(num)}
                className={`min-w-[28px] h-7 px-2 rounded-lg border text-xs transition flex items-center justify-center ${
                  num === validCurrentPage ? activeBtnClass : btnBorder
                }`}
              >
                {num}
              </button>
            )
          ))}
        </div>

        {/* Next Page */}
        <button
          onClick={() => handlePageClick(validCurrentPage + 1)}
          disabled={validCurrentPage === totalPages}
          className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${btnBorder}`}
          title="Trang sau"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => handlePageClick(totalPages)}
          disabled={validCurrentPage === totalPages}
          className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${btnBorder}`}
          title="Trang cuối"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Custom hook for simple client-side list pagination
 */
export function usePagination(items = [], defaultPageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  // Auto-adjust page if items length shrinks
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [items.length, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = React.useMemo(() => {
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, startIndex, pageSize]);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    setCurrentPage,
    setPageSize
  };
}
