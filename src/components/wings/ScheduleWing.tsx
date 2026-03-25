import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';

interface AnimeSchedule {
  id: number;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  format: string;
  status: string;
  episodes: number | null;
  duration: number | null;
  cover_image_large: string | null;
  cover_image_medium: string | null;
  start_date_year: number | null;
  start_date_month: number | null;
  start_date_day: number | null;
  end_date_year: number | null;
  end_date_month: number | null;
  end_date_day: number | null;
  season: string;
  season_year: number;
  genres: string[];
  studios: string[];
  next_airing_at: number | null;
  time_until_airing: number | null;
  next_episode: number | null;
}

type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

const getCurrentSeason = (): Season => {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 3) return 'WINTER';
  if (month >= 4 && month <= 6) return 'SPRING';
  if (month >= 7 && month <= 9) return 'SUMMER';
  return 'FALL';
};

const getCurrentYear = () => new Date().getFullYear();

const formatTimeUntilAiring = (seconds: number): string => {
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分後`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}時間後`;
  } else {
    return `${Math.floor(seconds / 86400)}日後`;
  }
};

const formatDate = (year: number | null, month: number | null, day: number | null): string => {
  if (!year || !month || !day) return '未定';
  return `${year}年${month}月${day}日`;
};

const getDisplayTitle = (anime: AnimeSchedule): string => {
  return anime.title_english || anime.title_romaji;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'RELEASING':
      return 'text-green-400';
    case 'FINISHED':
      return 'text-gray-400';
    case 'NOT_YET_RELEASED':
      return 'text-blue-400';
    case 'CANCELLED':
      return 'text-red-400';
    default:
      return 'text-gray-300';
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'RELEASING':
      return '放送中';
    case 'FINISHED':
      return '完了';
    case 'NOT_YET_RELEASED':
      return '未放送';
    case 'CANCELLED':
      return '中止';
    default:
      return status;
  }
};

export const ScheduleWing: React.FC = () => {
  const [animeList, setAnimeList] = useState<AnimeSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season>(getCurrentSeason());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());

  const fetchSchedule = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<AnimeSchedule[]>('get_anime_schedule', {
        season: selectedSeason,
        year: selectedYear,
      });
      setAnimeList(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch anime schedule');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    // eslint-disable-next-line -- season/year 変更時は手動で再取得
  }, [selectedSeason, selectedYear]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4">
              <div className="flex space-x-4">
                <div className="w-16 h-20 bg-gray-700 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <h3 className="text-red-400 font-medium">エラー</h3>
          <p className="text-red-300">{error}</p>
          <button
            type="button"
            onClick={fetchSchedule}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">放送スケジュール</h1>
        <div className="flex space-x-4">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value as Season)}
            className="px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            title="シーズンを選択"
          >
            <option value="WINTER">冬</option>
            <option value="SPRING">春</option>
            <option value="SUMMER">夏</option>
            <option value="FALL">秋</option>
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            title="年を選択"
          >
            {[2024, 2023, 2022].map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {animeList.map((anime) => (
          <div
            key={anime.id}
            className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
          >
            <div className="flex space-x-4">
              <div className="flex-shrink-0 w-16 h-20 bg-gray-700 rounded overflow-hidden">
                {anime.cover_image_medium ? (
                  <img
                    src={anime.cover_image_medium}
                    alt={getDisplayTitle(anime)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">📺</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-100 truncate">{getDisplayTitle(anime)}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(anime.status)}`}>
                    {getStatusText(anime.status)}
                  </span>
                </div>

                <div className="text-sm text-gray-300 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>放送期間:</span>
                    <span>
                      {formatDate(
                        anime.start_date_year,
                        anime.start_date_month,
                        anime.start_date_day,
                      )}
                    </span>
                    {anime.end_date_year && (
                      <>
                        <span>〜</span>
                        <span>
                          {formatDate(
                            anime.end_date_year,
                            anime.end_date_month,
                            anime.end_date_day,
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  {anime.episodes && (
                    <div className="flex items-center space-x-2">
                      <span>全{anime.episodes}話</span>
                      {anime.duration && <span>・{anime.duration}分</span>}
                    </div>
                  )}

                  {anime.studios.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span>制作:</span>
                      <span>{anime.studios.join(', ')}</span>
                    </div>
                  )}

                  {anime.next_airing_at && anime.time_until_airing && (
                    <div className="flex items-center space-x-2 text-blue-400">
                      <span>第{anime.next_episode}話:</span>
                      <span>{formatTimeUntilAiring(anime.time_until_airing)}</span>
                    </div>
                  )}

                  {anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {anime.genres.slice(0, 3).map((genre) => (
                        <span
                          key={genre}
                          className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {genre}
                        </span>
                      ))}
                      {anime.genres.length > 3 && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          +{anime.genres.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {animeList.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-4">
            このシーズンのアニメが見つかりませんでした
          </div>
        </div>
      )}
    </div>
  );
};
