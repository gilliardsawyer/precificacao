const fs = require('fs');

let code = fs.readFileSync('e:/precificacao/src/js/main.js', 'utf-8');

// The original imports had them:
// 11: let editingItemId = STATE.editingItemId;
// 12: let searchTerm = STATE.searchTerm;
// 13: let compareWorkbookId = STATE.compareWorkbookId;
// AND 76, 77, 78 had the exact same declarations!
// Let's remove the second occurrence.

const targetObj = `let editingItemId = STATE.editingItemId;
let searchTerm = STATE.searchTerm;
let compareWorkbookId = STATE.compareWorkbookId;`;
const firstIdx = code.indexOf(targetObj);
if (firstIdx !== -1) {
  const secondIdx = code.indexOf(targetObj, firstIdx + 10);
  if (secondIdx !== -1) {
    code = code.slice(0, secondIdx) + code.slice(secondIdx + targetObj.length);
  } else {
    // maybe line endings differ
    code = code.replace(/let editingItemId = STATE\\.editingItemId;\\s*let searchTerm = STATE\\.searchTerm;\\s*let compareWorkbookId = STATE\\.compareWorkbookId;/g, (match, offset) => offset === firstIdx ? match : '');
  }
}

// Ensure strict cleanup of updateActiveWorkbook
let uStart = code.indexOf('function updateActiveWorkbook(');
if (uStart !== -1) {
   let uEnd = code.indexOf('debouncedSaveWorkbooks(nextWorkbooks);', uStart);
   if (uEnd !== -1) {
     let closeBrace = code.indexOf('}', uEnd);
     code = code.slice(0, uStart) + code.slice(closeBrace + 1);
   }
}

// Ensure strict cleanup of invalidateSummaryCache
let invStart = code.indexOf('function invalidateSummaryCache()');
if (invStart !== -1) {
  let invEnd = code.indexOf('}', invStart);
  code = code.slice(0, invStart) + code.slice(invEnd + 1);
}

fs.writeFileSync('e:/precificacao/src/js/main.js', code, 'utf-8');
console.log("Cleanup Success.");
