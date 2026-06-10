import { parseOffice } from 'officeparser';

console.log("parseOffice function signature / length:", parseOffice.length);
try {
  // Let's inspect the typings or string representation if possible
  console.log("parseOffice.toString():", parseOffice.toString());
} catch (e) {
  console.error(e);
}
