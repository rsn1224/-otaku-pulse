import type React from 'react';
import { FeedsSection } from '../library/FeedsSection';

// ADR-10: Library = 購読フィード/ソース管理（OPML import/export・フィード状態）。
// 旧 Library（ブックマーク表示）は Pulse の Saved タブに集約済み。
export function LibraryWing(): React.JSX.Element {
  return (
    <div className="h-full flex flex-col bg-(--surface)">
      <div className="universal-tabs">
        <span className="tab-item active">ソース管理</span>
      </div>

      <div className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column py-4">
          <FeedsSection />
        </div>
      </div>
    </div>
  );
}
