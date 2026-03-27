# Rust パフォーマンスチューニングルール

<!-- OtakuPulse 専用: Tauri v2 + tokio + reqwest 環境 -->

## 🔴 最重要: プロファイリング・ファースト原則
**計測なき最適化を行わない。**
`cargo clippy -- -W clippy::perf` でパフォーマンス警告を先に確認すること。

## 📦 Cargo.toml リリースプロファイル

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true

[profile.profiling]
inherits = "release"
debug = true
strip = false
```

## 🧠 メモリアロケーション
- ホットパスの `Vec::new()` 復制り返し → `Vec::with_capacity(n)` で事前確保
- 小さな一時的コレクション → `SmallVec<[T; N]>` でヒープアロケーション回避
- 不必要な `.clone()` をホットパスで行わないこと

## 🔑 ハッシュマップの選択
- デフォルトの `HashMap` は SipHash（遥延大）→ `ahash::AHashMap` を使用する
- 並列書き込みが必要な場合 → `Arc<Mutex<HashMap>>` より `DashMap` を優先する

```rust
use ahash::AHashMap;
type FastMap<K, V> = AHashMap<K, V>;
```

## ⚡ 非同期とスレッド
- CPUバウンドな処理を `async fn` 内に書かない → `tokio::task::spawn_blocking` に受け渡す
- Mutexロックを確保したまま `.await` 絶対禁止（デッドロックの温床）
- `Mutex` でロック競合が激しい場合 → `parking_lot::RwLock` に切り替える
- パラレルデータ処理（フィード取得など）には `rayon` を検討する

## 🔬 インライン化
- 頻繁に呼ばれる小さな関数には `#[inline]` を付ける
- `#[inline(always)]` はベンチマーク上の計測後にのみ使用する（乱用するとキャッシュ汚染）

## 📊 データ構造のキャッシュ効率
- struct のフィールド順は「よく使うフィールドを先頭」に並べる
- `std::mem::size_of::<T>()` で構造体サイズを定期確認する
- 大きな enum は `Box<T>` でヒープに逃がす

## 🛠 プロファイリングツール

| ツール | 用途 | コマンド |
|--------|------|--------|
| cargo-flamegraph | ホットパスの可視化 | `cargo flamegraph --bin otaku-pulse` |
| criterion | ミクロベンチマーク | `cargo bench` |
| cargo-show-asm | 生成アセンブリ確認 | `cargo asm --lib func_name` |
| cargo bloat | バイナリサイズ分析 | `cargo bloat --release` |

## 📝 セッション学習メモ（Claude Code が追記）
<!-- 上記ルール通りにしたら解決した事例や新は発見をここに蓄積 -->
