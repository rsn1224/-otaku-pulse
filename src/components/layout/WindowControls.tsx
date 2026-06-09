import type React from 'react';

/**
 * ブラウザ運用ではネイティブのウィンドウ chrome（最小化/最大化/閉じる）を OS が提供するため、
 * 自作タイトルバー制御は描画しない。Tauri 撤去に伴い無効化。
 */
export function WindowControls(): React.JSX.Element | null {
  return null;
}
