/**
 * BuzzFizz関数 - 1から100までの数値を処理
 * - 3の倍数の場合: "Fizz"を出力
 * - 5の倍数の場合: "Buzz"を出力
 * - 3と5の両方の倍数の場合: "FizzBuzz"を出力
 * - それ以外: 数値をそのまま出力
 * @returns {string[]} 処理結果の配列
 */
export function buzzfizz() {
  const results = [];

  for (let i = 1; i <= 100; i++) {
    if (i % 3 === 0 && i % 5 === 0) {
      results.push("FizzBuzz");
      console.log("FizzBuzz");
    } else if (i % 3 === 0) {
      results.push("Fizz");
      console.log("Fizz");
    } else if (i % 5 === 0) {
      results.push("Buzz");
      console.log("Buzz");
    } else {
      results.push(i.toString());
      console.log(i);
    }
  }

  return results;
}

/**
 * デフォルトエクスポート関数
 * @returns {string[]} 処理結果の配列
 */
export default function runBuzzFizz() {
  return buzzfizz();
}
