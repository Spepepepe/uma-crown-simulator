// =============================================
// race-pattern 専用定数
// race-pattern.service.ts から分離した定数群
// =============================================

import type { GradeName } from '@uma-crown/shared';

// ============================================================
// 適性スコアマップ
// ============================================================

/** 適性ランク文字 → 数値スコアの変換マップ（S=4 〜 G=-3） */
export const APTITUDE_MAP: Record<string, number> = {
  S: 4, A: 3, B: 2, C: 1, D: 0, E: -1, F: -2, G: -3,
};

// ============================================================
// 馬場・距離名称マップ
// ============================================================

/** 馬場区分数値 → 日本語名称変換マップ（0=芝, 1=ダート） */
export const SURFACE_NAMES: Record<number, string> = { 0: '芝', 1: 'ダート' };

/** 距離区分数値 → 日本語名称変換マップ（1=短距離〜4=長距離） */
export const DISTANCE_NAMES: Record<number, string> = {
  1: '短距離', 2: 'マイル', 3: '中距離', 4: '長距離',
};

// ============================================================
// ラーク関連定数
// ============================================================

/**
 * ラーク候補パターンの通常割り当てから除外するレース名セット
 * 日本ダービーも含む（classic 5月後半はラーク強制配置スロットのため）
 */
export const LARC_EXCLUSIVE_NAMES = new Set([
  '凱旋門賞', 'ニエル賞', 'フォワ賞', '宝塚記念', '日本ダービー',
]);

/**
 * ラーク候補パターンに強制配置するレース定義
 * タプル形式: [grade, race_name, month, half]
 */
export const LARC_MANDATORY: [GradeName, string, number, boolean][] = [
  ['classic', '日本ダービー', 5, true],
  ['classic', 'ニエル賞', 9, false],
  ['classic', '凱旋門賞', 10, false],
  ['senior', '宝塚記念', 6, true],
  ['senior', 'フォワ賞', 9, false],
  ['senior', '凱旋門賞', 10, false],
];

/** larc_flag を持たないがラーク残存判定に使うレース名セット */
export const LARC_SPECIFIC_NAMES = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞']);

// ============================================================
// BC 関連定数
// ============================================================

/** BC最終レースのスロット（全BCレース共通：シニア11月前半） */
export const BC_FINAL_SLOT: { grade: GradeName; month: number; half: boolean } = {
  grade: 'senior', month: 11, half: false,
};

/**
 * BCシナリオ各最終レースへのルートで走る必要がある中間 G1/G2/G3 レース定義
 * キー: BC最終レース名、値: タプル配列 [grade, race_name, month, half]
 */
export const BC_MANDATORY: Record<string, [GradeName, string, number, boolean][]> = {
  'BCターフ': [
    ['junior',  'ホープフルステークス',               12, true],
    ['classic', '日本ダービー',                        5,  true],
    ['classic', 'ジャパンカップ',                      11, true],
    ['senior',  '宝塚記念',                            6,  true],
  ],
  'BCフィリー＆メアターフ': [
    ['junior',  '阪神ジュベナイルフィリーズ',          12, false],
    ['classic', 'オークス',                            5,  true],
    ['classic', 'エリザベス女王杯',                    11, false],
    ['senior',  'ヴィクトリアマイル',                  5,  false],
  ],
  'BCターフスプリント': [
    ['junior',  '京王杯ジュニアステークス',            11, false],
    ['classic', '葵ステークス',                        5,  true],
    ['classic', 'スプリンターズステークス',             9,  true],
    ['senior',  '高松宮記念',                          3,  true],
  ],
  'BCマイル': [
    ['junior',  '朝日杯フューチュリティステークス',    12, false],
    ['classic', 'NHKマイルカップ',                     5,  false],
    ['classic', 'マイルチャンピオンシップ',             11, true],
    ['senior',  '安田記念',                            6,  false],
  ],
  'BCスプリント': [
    ['junior',  'オキザリス賞',                        11, false],
    ['classic', '昇竜ステークス',                      3,  false],
    ['classic', 'JBCスプリント',                       11, false],
    ['senior',  '根岸ステークス',                      1,  true],
  ],
  'BCフィリー＆メアスプリント': [
    ['junior',  'オキザリス賞',                        11, false],
    ['classic', '昇竜ステークス',                      3,  false],
    ['classic', 'JBCスプリント',                       11, false],
    ['senior',  '根岸ステークス',                      1,  true],
  ],
  'BCダートマイル': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', 'ユニコーンステークス',                 6,  true],
    ['classic', 'マイルチャンピオンシップ南部杯',       10, false],
    ['senior',  'フェブラリーステークス',               2,  true],
  ],
  'BCディスタフ': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', '関東オークス',                        6,  false],
    ['classic', 'JBCレディスクラシック',               11, false],
    ['senior',  'TCK女王盃',                           1,  true],
  ],
  'BCクラシック': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', 'ジャパンダートダービー',               7,  false],
    ['classic', 'JBCクラシック',                       11, false],
    ['senior',  '帝王賞',                              6,  true],
  ],
};

// ============================================================
// スロット線形順序（連続出走判定用）
// junior:  7月前〜12月後（index  0-11）
// classic: 1月前〜12月後（index 12-35）
// senior:  1月前〜12月後（index 36-59）
// ============================================================

/**
 * 育成全期間のスロットを時系列順に並べた配列
 * junior(7〜12月) → classic(1〜12月) → senior(1〜12月) の順
 */
export const ORDERED_SLOTS: { grade: GradeName; month: number; half: boolean }[] = [];
for (let m = 7; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'junior', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'junior', month: m, half: true });
}
for (let m = 1; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'classic', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'classic', month: m, half: true });
}
for (let m = 1; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'senior', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'senior', month: m, half: true });
}

/** スロットキー文字列 → ORDERED_SLOTS インデックスの逆引きマップ */
export const SLOT_INDEX_MAP = new Map<string, number>();
ORDERED_SLOTS.forEach((s, i) => {
  SLOT_INDEX_MAP.set(`${s.grade}|${s.month}|${s.half}`, i);
});

// ============================================================
// 適性ランク順序
// ============================================================

/** 適性ランク昇順配列（G が最低, S が最高）。`applyStrategyToAptitude` で使用 */
export const RANK_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
