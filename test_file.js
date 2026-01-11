// Simple test file with code issues
// TODO: Fix this later

const badVar = "unused"; // unused variable

function calc(a, b, c) { // bad naming
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) { // nested loop
      sum += a + b + c;
    }
  }
  return sum; // function too long with nested loops
}

console.log("debug"); // console.log

module.exports = { calc };