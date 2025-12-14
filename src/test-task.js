/**
 * Hello Worldを出力する関数
 * @returns {string} "Hello World"メッセージ
 * @throws {Error} 出力に失敗した場合
 */
export function sayHelloWorld() {
  try {
    const message = "Hello World";
    console.log(message);
    return message;
  } catch (error) {
    throw new Error(`Hello World出力エラー: ${error.message}`);
  }
}

/**
 * デフォルトエクスポート関数
 * @returns {string} "Hello World"メッセージ
 */
export default function helloWorld() {
  return sayHelloWorld();
}