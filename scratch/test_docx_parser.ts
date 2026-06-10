/* eslint-disable */
import { parseOffice } from 'officeparser';
import * as fs from 'fs';

async function test() {
  try {
    const buffer = fs.readFileSync('c:/Users/Nova/OneDrive/Documents/GitHub/Dealcollab/updated profile creation fileds.docx');
    const result = await parseOffice(buffer) as any;
    console.log("result.toText type:", typeof result.toText);
    if (result.toText) {
      const text = result.toText();
      console.log("toText output type:", typeof text);
      console.log("toText output length:", text.length);
      console.log("toText output preview:\n", text.slice(0, 500));
    }
  } catch (e) {
    console.error("Error testing toText:", e);
  }
}

test();
