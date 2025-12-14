import { sum } from './sum.js';

// 簡単なテスト
console.log('Testing sum function...');

// テスト1: 正の数の加算
const test1 = sum(2, 3);
console.assert(test1 === 5, `Test 1 failed: expected 5, got ${test1}`);
console.log('✓ Test 1 passed: sum(2, 3) = 5');

// テスト2: 負の数の加算
const test2 = sum(-1, 1);
console.assert(test2 === 0, `Test 2 failed: expected 0, got ${test2}`);
console.log('✓ Test 2 passed: sum(-1, 1) = 0');

// テスト3: 小数の加算
const test3 = sum(0.1, 0.2);
console.assert(Math.abs(test3 - 0.3) < 0.0001, `Test 3 failed: expected ~0.3, got ${test3}`);
console.log('✓ Test 3 passed: sum(0.1, 0.2) ≈ 0.3');

// テスト4: ゼロの加算
const test4 = sum(0, 0);
console.assert(test4 === 0, `Test 4 failed: expected 0, got ${test4}`);
console.log('✓ Test 4 passed: sum(0, 0) = 0');

console.log('\nAll tests passed! ✓');
