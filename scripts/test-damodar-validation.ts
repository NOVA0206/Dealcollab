import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

import { extractTextFromFile } from '../src/lib/documentParser';
import { cleanAndStructureDocument } from '../src/lib/intelligenceEngine';
import { initializeStateFromDocument } from '../src/lib/stateManager';

async function main() {
  console.log("=== STARTING PROJECT DAMODAR VALIDATION TEST ===");

  const pdfPath = path.resolve(process.cwd(), 'Project_Damodar.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ Project_Damodar.pdf not found at ${pdfPath}`);
    process.exit(1);
  }

  console.log(`[TEST] Reading Project_Damodar.pdf...`);
  const buffer = fs.readFileSync(pdfPath);

  // 1. Extract raw text from PDF
  console.log(`[TEST] Extracting raw text via PDFJS...`);
  const rawText = await extractTextFromFile(buffer, 'application/pdf', 'Project_Damodar.pdf');
  console.log(`[TEST] Raw Text Extracted:`);
  console.log("----------------------------------------");
  console.log(rawText);
  console.log("----------------------------------------");

  // Validate raw text contains critical info
  if (!rawText.toLowerCase().includes("damodar")) {
    console.error("❌ Raw extraction test failed: 'Damodar' keyword missing");
    process.exit(1);
  }
  console.log("✅ Raw text extraction verified.");

  // 2. Clean and structure document
  console.log(`[TEST] Structuring text into M&A intelligence...`);
  const structured = await cleanAndStructureDocument(rawText);
  console.log(`[TEST] Structured JSON Output:`);
  console.log(JSON.stringify(structured, null, 2));

  // Required validations
  const validations = [
    {
      field: "RDSO approval",
      check: () => structured.certifications.some(c => c.toUpperCase().includes("RDSO"))
    },
    {
      field: "Railway casting business",
      check: () => (structured.subsector && structured.subsector.toLowerCase().includes("casting")) || 
                   (structured.industry && structured.industry.toLowerCase().includes("casting")) ||
                   (structured.company_overview && structured.company_overview.toLowerCase().includes("casting"))
    },
    {
      field: "₹100 Cr valuation",
      check: () => (structured.deal_value && structured.deal_value.includes("100")) || 
                   (structured.deal_size && structured.deal_size.includes("100"))
    },
    {
      field: "700 MT capacity",
      check: () => structured.capacity && structured.capacity.includes("700")
    },
    {
      field: "400 MT production",
      check: () => structured.production && structured.production.includes("400")
    },
    {
      field: "23 acre campus",
      check: () => structured.strategic_assets && structured.strategic_assets.some(a => a.toLowerCase().includes("23") && a.toLowerCase().includes("campus"))
    },
    {
      field: "East India location",
      check: () => (structured.geography && structured.geography.toLowerCase().includes("east")) ||
                   (structured.location && structured.location.toLowerCase().includes("east"))
    },
    {
      field: "Railways/BHEL/Tata customers",
      check: () => structured.customers && 
                   structured.customers.some(c => c.toLowerCase().includes("railway")) &&
                   structured.customers.some(c => c.toLowerCase().includes("bhel")) &&
                   structured.customers.some(c => c.toLowerCase().includes("tata"))
    }
  ];

  let failedCount = 0;
  for (const val of validations) {
    try {
      if (val.check()) {
        console.log(`✅ Verified Field: ${val.field}`);
      } else {
        console.error(`❌ Field Missing or Invalid: ${val.field}`);
        failedCount++;
      }
    } catch (err) {
      console.error(`❌ Validation check crashed for: ${val.field}`, err);
      failedCount++;
    }
  }

  if (failedCount > 0) {
    console.error(`❌ Validation failed with ${failedCount} errors.`);
    process.exit(1);
  }

  // 3. Initialize state from structured document
  console.log(`[TEST] Populating State Manager...`);
  const state = initializeStateFromDocument(structured as unknown as Record<string, unknown>);
  console.log(`[TEST] Initialized Router State:`);
  console.log(JSON.stringify({
    intent: state.intent,
    sector: state.sector,
    sub_sector: state.sub_sector,
    geography: state.geography,
    deal_size: state.deal_size,
    revenue: state.revenue,
    is_document_intake: state.is_document_intake,
    m4_questions_asked: state.m4_questions_asked,
    is_sufficient: state.is_sufficient,
    phase: state.phase,
    industry_data: state.industry_data
  }, null, 2));

  // Assertions on the seeded state
  if (state.intent !== 'SELL_SIDE') {
    console.error(`❌ State Assertion Failed: intent expected SELL_SIDE, got ${state.intent}`);
    process.exit(1);
  }
  if (state.sector !== 'manufacturing') {
    console.error(`❌ State Assertion Failed: sector expected manufacturing, got ${state.sector}`);
    process.exit(1);
  }
  if (!state.geography || !state.geography.toLowerCase().includes("east")) {
    console.error(`❌ State Assertion Failed: geography expected East India, got ${state.geography}`);
    process.exit(1);
  }
  if (!state.deal_size || !state.deal_size.includes("100")) {
    console.error(`❌ State Assertion Failed: deal_size expected 100 Cr range, got ${state.deal_size}`);
    process.exit(1);
  }
  if (!state.is_document_intake) {
    console.error(`❌ State Assertion Failed: is_document_intake must be true`);
    process.exit(1);
  }
  if (!state.m4_questions_asked) {
    console.error(`❌ State Assertion Failed: m4_questions_asked must be true`);
    process.exit(1);
  }
  if (!state.is_sufficient) {
    console.error(`❌ State Assertion Failed: is_sufficient must be true`);
    process.exit(1);
  }
  if (state.phase !== 'MOMENTUM') {
    console.error(`❌ State Assertion Failed: phase expected MOMENTUM, got ${state.phase}`);
    process.exit(1);
  }

  // Check industry_data values specifically
  const ind = state.industry_data;
  if (!ind.capacity || !String(ind.capacity).includes("700")) {
    console.error(`❌ State Assertion Failed: industry_data.capacity missing or invalid: ${ind.capacity}`);
    process.exit(1);
  }
  if (!ind.production || !String(ind.production).includes("400")) {
    console.error(`❌ State Assertion Failed: industry_data.production missing or invalid: ${ind.production}`);
    process.exit(1);
  }
  if (!ind.certifications || !String(ind.certifications).toUpperCase().includes("RDSO")) {
    console.error(`❌ State Assertion Failed: industry_data.certifications missing or invalid: ${ind.certifications}`);
    process.exit(1);
  }
  if (!ind.client_concentration || !String(ind.client_concentration).toLowerCase().includes("bhel")) {
    console.error(`❌ State Assertion Failed: industry_data.client_concentration missing or invalid: ${ind.client_concentration}`);
    process.exit(1);
  }
  if (!ind.strategic_assets || !String(ind.strategic_assets).toLowerCase().includes("campus")) {
    console.error(`❌ State Assertion Failed: industry_data.strategic_assets missing or invalid: ${ind.strategic_assets}`);
    process.exit(1);
  }

  console.log("\n✅ ALL PROJECT DAMODAR VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

main().catch(err => {
  console.error("❌ Test script crashed:", err);
  process.exit(1);
});
