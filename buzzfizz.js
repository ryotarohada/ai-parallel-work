/**
 * Buzzfizz function - A variant of the classic FizzBuzz problem
 *
 * Rules:
 * - Numbers divisible by 3 return "Buzz"
 * - Numbers divisible by 5 return "Fizz"
 * - Numbers divisible by both 3 and 5 return "BuzzFizz"
 * - Otherwise return the number as a string
 *
 * @param {number} n - The number to evaluate
 * @returns {string} - "Buzz", "Fizz", "BuzzFizz", or the number as string
 */
export function buzzfizz(n) {
  if (n % 15 === 0) {
    return "BuzzFizz";
  } else if (n % 3 === 0) {
    return "Buzz";
  } else if (n % 5 === 0) {
    return "Fizz";
  } else {
    return String(n);
  }
}

/**
 * Generate buzzfizz sequence from 1 to n
 *
 * @param {number} max - Maximum number in the sequence
 * @returns {string[]} - Array of buzzfizz results
 */
export function buzzfizzSequence(max) {
  const result = [];
  for (let i = 1; i <= max; i++) {
    result.push(buzzfizz(i));
  }
  return result;
}

/**
 * Print buzzfizz sequence from 1 to n
 *
 * @param {number} max - Maximum number in the sequence
 */
export function printBuzzfizz(max) {
  for (let i = 1; i <= max; i++) {
    console.log(`${i}: ${buzzfizz(i)}`);
  }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Buzzfizz examples:");
  console.log("==================");
  printBuzzfizz(20);
}
