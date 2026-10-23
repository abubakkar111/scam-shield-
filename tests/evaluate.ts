import { runSecurityRules } from '../lib/rules.ts';

const TEST_CASES = [
  {
    id: 1,
    name: 'Easypaisa Accidental Transfer Scam',
    text: '0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.',
    expected: 'high',
    type: 'Accidental Transfer Fraud',
  },
  {
    id: 2,
    name: 'Fake BISP Welfare Scheme Link',
    text: 'Benazir Income Support Program: Apka 25,000 ka wazifa manzoor ho gaya hai. Abhi register karein: http://bisp-wazifa-claim.xyz/verify',
    expected: 'high',
    type: 'Government Phishing',
  },
  {
    id: 3,
    name: 'JazzCash Account Block Threat',
    text: 'Moaziz sarif, aapka JazzCash account block ho chuka hai. Biometric verify karein: http://jazzcash-unblock.click/auth',
    expected: 'high',
    type: 'Account Suspension Phishing',
  },
  {
    id: 4,
    name: 'Jeeto Pakistan / Car Prize Scam',
    text: 'Mubarak ho aap Jeeto Pakistan inam mein car jeet chukay hain. Advance fee 5000 bhejein inam hasil karne ke liye.',
    expected: 'high',
    type: 'Lottery & Advance Fee Scam',
  },
  {
    id: 5,
    name: 'Bank OTP Stealing Attack',
    text: 'Bank Alert: Apka ATM card expire ho raha hai. Fori helpline agent ko OTP batayein taakay card block na ho.',
    expected: 'high',
    type: 'Credential & OTP Harvesting',
  },
  {
    id: 6,
    name: 'Fake Daily Earning / Job Scam',
    text: 'Ghar baithe job from home se daily earning 5000 kamayein. Shuru karne ke liye advance fee register karein.',
    expected: 'high',
    type: 'Task & Advance Fee Scam',
  },
  {
    id: 7,
    name: 'FESCO Electricity Phishing Link',
    text: 'FESCO Alert: Bijli ke bill par 30% discount ke liye abhi click karein: http://tinyurl.com/fesco-bill-discount',
    expected: 'high',
    type: 'Utility Bill Phishing',
  },
  {
    id: 8,
    name: 'Genuine Bank OTP Notification',
    text: 'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.',
    expected: 'low',
    type: 'Legitimate Banking Notification',
  },
  {
    id: 9,
    name: 'Genuine Easypaisa Receipt',
    text: 'You have received Rs. 2,000 from Ahmad Raza. Your new Easypaisa balance is Rs. 15,400. Transaction ID: 8934710.',
    expected: 'low',
    type: 'Legitimate Payment Receipt',
  },
  {
    id: 10,
    name: 'Genuine Everyday WhatsApp Message',
    text: 'Assalam-o-Alaikum bhai, kal University of Agriculture Faisalabad mein presentation kitne baje hai?',
    expected: 'low',
    type: 'Legitimate Social Message',
  },
];

console.log('========================================================================');
console.log('   SCAM SHIELD PAKISTAN: 10-CASE ACCURACY BENCHMARK EVALUATION');
console.log('========================================================================\n');

let passed = 0;

for (const test of TEST_CASES) {
  const result = runSecurityRules(test.text);
  const isMatch = result.overallRisk === test.expected || (test.expected === 'high' && result.overallRisk === 'medium');

  if (isMatch) passed++;

  console.log(`[TEST ${test.id}] ${test.name}`);
  console.log(`  Category: ${test.type}`);
  console.log(`  Expected: ${test.expected.toUpperCase()} | Detected: ${result.overallRisk.toUpperCase()}`);
  console.log(`  Violations: ${result.violations.map(v => v.matched).join(', ') || 'None (Clean)'}`);
  console.log(`  Status: ${isMatch ? 'PASSED [OK]' : 'FAILED'}\n`);
}

console.log('========================================================================');
console.log(`BENCHMARK RESULT: ${passed}/${TEST_CASES.length} Tests Passed (${(passed / TEST_CASES.length) * 100}% Accuracy)`);
console.log('========================================================================\n');
