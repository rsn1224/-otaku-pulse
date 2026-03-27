import type React from 'react';
import { useState } from 'react';
import { AdvancedSection } from '../profile/AdvancedSection';
import { FeedsSection } from '../profile/FeedsSection';
import { ProfileSection } from '../profile/ProfileSection';
import { LlmSettingsSection } from '../settings/LlmSettingsSection';

type ProfileTab = 'profile' | 'feeds' | 'ai' | 'advanced';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'feeds', label: 'フィード' },
  { id: 'ai', label: 'AI 設定' },
  { id: 'advanced', label: '詳細' },
];

export const ProfileWing: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <div className="universal-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`tab-item ${activeTab === t.id ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column py-4">
          {activeTab === 'profile' && <ProfileSection />}
          {activeTab === 'feeds' && <FeedsSection />}
          {activeTab === 'ai' && (
            <div className="discover-card">
              <LlmSettingsSection />
            </div>
          )}
          {activeTab === 'advanced' && <AdvancedSection />}
        </div>
      </div>
    </div>
  );
};
