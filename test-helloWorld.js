import helloWorld, { helloWorldWithName } from './helloWorld.js';

// 基本的なテスト
console.log('Testing helloWorld():');
const result1 = helloWorld();
console.log(`  Result: "${result1}"`);
console.assert(result1 === "Hello, World!", 'Test failed: helloWorld()');
console.log('  ✓ Test passed');

// カスタム名前でテスト
console.log('\nTesting helloWorldWithName("Alice"):');
const result2 = helloWorldWithName("Alice");
console.log(`  Result: "${result2}"`);
console.assert(result2 === "Hello, Alice!", 'Test failed: helloWorldWithName("Alice")');
console.log('  ✓ Test passed');

// 日本語名でテスト
console.log('\nTesting helloWorldWithName("太郎"):');
const result3 = helloWorldWithName("太郎");
console.log(`  Result: "${result3}"`);
console.assert(result3 === "Hello, 太郎!", 'Test failed: helloWorldWithName("太郎")');
console.log('  ✓ Test passed');

console.log('\n✅ All tests passed!');
