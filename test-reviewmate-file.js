// Test file for ReviewMate integration
// This file contains intentional code quality issues to test the review process

// TODO: This is a technical debt item that should be addressed
// ESLint violation: unused variable
const unusedVariable = "This variable is never used";

// ESLint violation: console.log in production code
console.log("This is a debug statement that should be removed");

// ESLint violation: missing semicolon (if configured)
const testFunction = function() {
  return "test"
}



// ESLint violation: inconsistent indentation
function badlyFormattedFunction() {
        return "badly indented";
}

// ESLint violation: no space after function keyword
function noSpaceAfterFunction(){
  return "no space";
}

// Clean code violation: function too long (if enforced)
function veryLongFunctionThatViolatesCleanCodePrinciples() {
  // This function does way too many things
  // It should be split into smaller functions
  const step1 = "do step 1";
  const step2 = "do step 2";
  const step3 = "do step 3";
  const step4 = "do step 4";
  const step5 = "do step 5";
  const step6 = "do step 6";
  const step7 = "do step 7";
  const step8 = "do step 8";
  const step9 = "do step 9";
  const step10 = "do step 10";

  // This is way too much logic in one function
  if (step1 && step2 && step3 && step4 && step5) {
    if (step6 || step7) {
      while (step8) {
        step9();
        step10();
      }
    }
  }

  return "done";
}

// Clean code violation: magic numbers
function calculateWithMagicNumbers(value) {
  return value * 42 + 17 - 3;
}

// Clean code violation: poor variable naming
function processData(a, b, c) {
  const x = a + b;
  const y = x * c;
  return y;
}

// Export the test functions
module.exports = {
  testFunction,
  badlyFormattedFunction,
  noSpaceAfterFunction,
  veryLongFunctionThatViolatesCleanCodePrinciples,
  calculateWithMagicNumbers,
  processData
};