import { extractTextFromFile } from '../src/lib/documentParser';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log("=== STARTING UNIVERSAL PARSER TESTS ===");

  // Test 1: Plain Text
  console.log("\n[TEST 1] Plain Text Extraction");
  const txtBuffer = Buffer.from("Hello, this is a test text document for DealCollab dynamic parser.", "utf-8");
  const txtResult = await extractTextFromFile(txtBuffer, "text/plain", "test.txt");
  console.log("Result:", txtResult);
  if (txtResult.includes("DealCollab")) {
    console.log("✅ Test 1 Passed!");
  } else {
    console.error("❌ Test 1 Failed!");
  }

  // Test 2: CSV Data
  console.log("\n[TEST 2] CSV Data Extraction");
  const csvBuffer = Buffer.from("Company,Revenue,EBITDA,Sector\nAcme Corp,50 Cr,8 Cr,SaaS\nBeta Inc,20 Cr,3 Cr,Pharma", "utf-8");
  const csvResult = await extractTextFromFile(csvBuffer, "text/csv", "test.csv");
  console.log("Result:", csvResult);
  if (csvResult.includes("Acme Corp") && csvResult.includes("50 Cr")) {
    console.log("✅ Test 2 Passed!");
  } else {
    console.error("❌ Test 2 Failed!");
  }

  // Test 3: Legacy Binary strings extraction fallback
  console.log("\n[TEST 3] Legacy Binary Format Strings Fallback (.doc)");
  // Create a mock binary buffer with some embeded text
  const docBuffer = Buffer.concat([
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // CFBF header
    Buffer.alloc(100),
    Buffer.from("Acme Financial Holdings Deal Size 100 Crore Strategic buyer", "utf-8"),
    Buffer.alloc(100)
  ]);
  const docResult = await extractTextFromFile(docBuffer, "application/msword", "test.doc");
  console.log("Result (extracted strings):", docResult);
  if (docResult.includes("Acme Financial") && docResult.includes("100 Crore")) {
    console.log("✅ Test 3 Passed!");
  } else {
    console.error("❌ Test 3 Failed!");
  }

  // Test 4: Real DOCX File (if available)
  console.log("\n[TEST 4] Real DOCX Parser");
  const docxPath = path.resolve(process.cwd(), 'updated profile creation fileds.docx');
  if (fs.existsSync(docxPath)) {
    const docxBuffer = fs.readFileSync(docxPath);
    const docxResult = await extractTextFromFile(docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "updated profile creation fileds.docx");
    console.log("Result length:", docxResult.length);
    console.log("Result preview:", docxResult.slice(0, 200));
    if (docxResult.length > 100) {
      console.log("✅ Test 4 Passed!");
    } else {
      console.error("❌ Test 4 Failed!");
    }
  } else {
    console.log("⚠️ updated profile creation fileds.docx not found, skipping Test 4.");
  }

  console.log("\n=== ALL COMPLETED ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
