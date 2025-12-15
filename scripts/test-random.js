/**
 * ランダム数値生成関数のテストとデモンストレーション
 * Test and demonstration of random number generation functions
 */

import randomNumber from './randomNumber.js';

console.log('===== ランダム数値生成関数のテスト =====\n');

// 1. ランダムな整数の生成
console.log('1. generateRandomInt(1, 10):');
for (let i = 0; i < 5; i++) {
  console.log(`   - ${randomNumber.generateRandomInt(1, 10)}`);
}
console.log();

// 2. ランダムな浮動小数点数の生成
console.log('2. generateRandomFloat(0, 1, 2):');
for (let i = 0; i < 5; i++) {
  console.log(`   - ${randomNumber.generateRandomFloat(0, 1, 2)}`);
}
console.log();

// 3. 0から最大値までのランダムな整数
console.log('3. generateRandomUpTo(100):');
for (let i = 0; i < 5; i++) {
  console.log(`   - ${randomNumber.generateRandomUpTo(100)}`);
}
console.log();

// 4. 配列からランダムに要素を選択
console.log('4. selectRandomElement([\'apple\', \'banana\', \'orange\', \'grape\', \'melon\']):');
const fruits = ['apple', 'banana', 'orange', 'grape', 'melon'];
for (let i = 0; i < 5; i++) {
  console.log(`   - ${randomNumber.selectRandomElement(fruits)}`);
}
console.log();

// 5. ランダムな数値配列の生成
console.log('5. generateRandomArray(10, 1, 50):');
console.log(`   - [${randomNumber.generateRandomArray(10, 1, 50).join(', ')}]`);
console.log();

// 6. ランダムなブール値の生成
console.log('6. generateRandomBoolean(0.7):');
const booleans = [];
for (let i = 0; i < 10; i++) {
  booleans.push(randomNumber.generateRandomBoolean(0.7));
}
console.log(`   - [${booleans.join(', ')}]`);
console.log(`   - trueの数: ${booleans.filter(b => b).length}/10 (期待値: 約7)`);
console.log();

// 7. 重複しないランダムな整数の配列
console.log('7. generateUniqueRandomInts(5, 1, 10):');
console.log(`   - [${randomNumber.generateUniqueRandomInts(5, 1, 10).join(', ')}]`);
console.log();

console.log('===== テスト完了 =====');
