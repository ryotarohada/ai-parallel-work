/**
 * ランダムな数字を生成するユーティリティ関数群
 * Random number generation utility functions
 */

/**
 * 指定された範囲内のランダムな整数を生成
 * Generate a random integer within the specified range
 *
 * @param {number} min - 最小値（含む）/ Minimum value (inclusive)
 * @param {number} max - 最大値（含む）/ Maximum value (inclusive)
 * @returns {number} ランダムな整数 / Random integer
 *
 * @example
 * generateRandomInt(1, 10); // 1から10の間のランダムな整数
 * generateRandomInt(0, 100); // 0から100の間のランダムな整数
 */
export function generateRandomInt(min, max) {
  if (min > max) {
    throw new Error('最小値は最大値以下である必要があります / min must be less than or equal to max');
  }

  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 指定された範囲内のランダムな浮動小数点数を生成
 * Generate a random floating-point number within the specified range
 *
 * @param {number} min - 最小値（含む）/ Minimum value (inclusive)
 * @param {number} max - 最大値（含まない）/ Maximum value (exclusive)
 * @param {number} decimals - 小数点以下の桁数（オプション）/ Decimal places (optional)
 * @returns {number} ランダムな浮動小数点数 / Random floating-point number
 *
 * @example
 * generateRandomFloat(0, 1); // 0から1の間のランダムな数
 * generateRandomFloat(10.5, 20.5, 2); // 10.5から20.5の間のランダムな数（小数点以下2桁）
 */
export function generateRandomFloat(min, max, decimals = null) {
  if (min > max) {
    throw new Error('最小値は最大値以下である必要があります / min must be less than or equal to max');
  }

  const random = Math.random() * (max - min) + min;

  if (decimals !== null && decimals >= 0) {
    return Number(random.toFixed(decimals));
  }

  return random;
}

/**
 * 0から指定された最大値までのランダムな整数を生成
 * Generate a random integer from 0 to the specified maximum
 *
 * @param {number} max - 最大値（含む）/ Maximum value (inclusive)
 * @returns {number} ランダムな整数 / Random integer
 *
 * @example
 * generateRandomUpTo(100); // 0から100の間のランダムな整数
 */
export function generateRandomUpTo(max) {
  return generateRandomInt(0, max);
}

/**
 * 指定された配列からランダムに要素を選択
 * Select a random element from the specified array
 *
 * @param {Array} array - 配列 / Array
 * @returns {*} ランダムに選択された要素 / Randomly selected element
 *
 * @example
 * selectRandomElement([1, 2, 3, 4, 5]); // 配列からランダムな要素を返す
 * selectRandomElement(['apple', 'banana', 'orange']); // ランダムなフルーツ名を返す
 */
export function selectRandomElement(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error('空でない配列を指定してください / Please provide a non-empty array');
  }

  const randomIndex = generateRandomInt(0, array.length - 1);
  return array[randomIndex];
}

/**
 * 指定された長さのランダムな数値配列を生成
 * Generate an array of random numbers with the specified length
 *
 * @param {number} length - 配列の長さ / Array length
 * @param {number} min - 最小値（含む）/ Minimum value (inclusive)
 * @param {number} max - 最大値（含む）/ Maximum value (inclusive)
 * @returns {number[]} ランダムな数値の配列 / Array of random numbers
 *
 * @example
 * generateRandomArray(5, 1, 100); // 長さ5で1から100の範囲のランダムな整数配列
 */
export function generateRandomArray(length, min, max) {
  if (length < 0) {
    throw new Error('配列の長さは0以上である必要があります / Array length must be 0 or greater');
  }

  return Array.from({ length }, () => generateRandomInt(min, max));
}

/**
 * ランダムなブール値を生成
 * Generate a random boolean value
 *
 * @param {number} probability - trueになる確率（0-1の範囲、デフォルトは0.5）/ Probability of true (0-1 range, default 0.5)
 * @returns {boolean} ランダムなブール値 / Random boolean value
 *
 * @example
 * generateRandomBoolean(); // 50%の確率でtrueまたはfalse
 * generateRandomBoolean(0.7); // 70%の確率でtrue、30%の確率でfalse
 */
export function generateRandomBoolean(probability = 0.5) {
  if (probability < 0 || probability > 1) {
    throw new Error('確率は0から1の範囲で指定してください / Probability must be between 0 and 1');
  }

  return Math.random() < probability;
}

/**
 * 指定された範囲内の重複しないランダムな整数の配列を生成
 * Generate an array of unique random integers within the specified range
 *
 * @param {number} count - 生成する数の個数 / Number of integers to generate
 * @param {number} min - 最小値（含む）/ Minimum value (inclusive)
 * @param {number} max - 最大値（含む）/ Maximum value (inclusive)
 * @returns {number[]} 重複しないランダムな整数の配列 / Array of unique random integers
 *
 * @example
 * generateUniqueRandomInts(5, 1, 10); // 1から10の範囲で重複しない5つの整数
 */
export function generateUniqueRandomInts(count, min, max) {
  const range = max - min + 1;

  if (count > range) {
    throw new Error(`範囲内の数が不足しています。最大${range}個まで生成可能です / Not enough numbers in range. Maximum ${range} numbers can be generated`);
  }

  const numbers = new Set();

  while (numbers.size < count) {
    numbers.add(generateRandomInt(min, max));
  }

  return Array.from(numbers);
}

// デフォルトエクスポート
export default {
  generateRandomInt,
  generateRandomFloat,
  generateRandomUpTo,
  selectRandomElement,
  generateRandomArray,
  generateRandomBoolean,
  generateUniqueRandomInts,
};
