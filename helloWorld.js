/**
 * Hello World関数
 * @returns {string} "Hello, World!"メッセージを返す
 */
export function helloWorld() {
  return "Hello, World!";
}

/**
 * カスタムメッセージ付きHello World関数
 * @param {string} name - 挨拶する相手の名前
 * @returns {string} カスタマイズされた挨拶メッセージ
 */
export function helloWorldWithName(name) {
  return `Hello, ${name}!`;
}

// デフォルトエクスポート
export default helloWorld;
