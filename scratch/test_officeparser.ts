/* eslint-disable */
import * as officeparser from 'officeparser';

console.log("officeparser exports:", Object.keys(officeparser));
console.log("officeparser type:", typeof officeparser);
if (typeof officeparser === 'function') {
  console.log("officeparser is a function");
}
try {
  // Let's print out what methods/properties are on officeparser
  for (const key in officeparser) {
    console.log(`- ${key}: ${typeof (officeparser as any)[key]}`);
  }
} catch (e) {
  console.error(e);
}
