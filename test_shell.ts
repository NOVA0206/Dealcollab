import { isShellCompany } from './src/lib/dataQuality';

const text = "....... Software Technologies Private Limited | Incorporation: September, 2022 | Main Objects: I.T. & Software | R.O.: Ambala, Haryana | ASC: 10 Lakhs | PSC: 1 Lakhs Bank A/c: Recently Closed INC-20A timely filed Annual filing: All Done for 3 F.Y. Turnover: Zero in all F.Y. GST: Cancelled Suo-Moto (01-10-24)";

console.log('Is shell?', isShellCompany(text));
