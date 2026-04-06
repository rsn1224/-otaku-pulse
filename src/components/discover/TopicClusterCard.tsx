import React, { useState } from 'react';
import type { ClusterGroup } from '../../types';
import { DiscoverCard } from './DiscoverCard';

interface TopicClusterCardProps {
  group: ClusterGroup;
}

export function TopicClusterCard({ group }: TopicClusterCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4">
      <DiscoverCard article={group.representative} />
      {group.others.length > 0 && (
        <div className="ml-4 border-l-2 border-l-(--primary-soft) pl-3">
          <button
            type="button"
            className="text-xs text-(--on-surface-variant) hover:text-(--primary) py-1 transition-colors"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '▲ 折りたたむ' : `▼ 他 ${group.others.length} 件`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {group.others.map((article) => (
                <DiscoverCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
