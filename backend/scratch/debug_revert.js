const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const DATA = "0x414bf389000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e00000000000000000000000042000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000009caee33df9b2735247776e51f9cc15e7ddf588e80000000000000000000000000000000000000000000000000000000069f744dd0000000000000000000000000000000000000000000000000000000000200b20000000000000000000000000000000000000000000000000002b7b3778aed67b0000000000000000000000000000000000000000000000000000000000000000";
const FROM = "0x9CAEE33dF9b2735247776e51f9Cc15E7dDf588E8";
const TO = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";

async function debugCall() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    console.log('Simulating call...');
    const result = await provider.call({
      from: FROM,
      to: TO,
      data: DATA
    });
    console.log('Call succeeded (unexpectedly):', result);
  } catch (err) {
    console.log('Call failed as expected.');
    console.log('Error Code:', err.code);
    console.log('Error Data:', err.data);
    
    if (err.data) {
      try {
        // Try to decode revert reason if it's a standard Error(string)
        const reason = ethers.toUtf8String('0x' + err.data.slice(138));
        console.log('Potential Revert Reason:', reason);
      } catch (e) {}
    }
    
    // Check if it's a Uniswap V3 error (they often use 3-character codes)
    if (err.data && err.data.length >= 10) {
       console.log('Raw Revert Data:', err.data);
    }
  }
}

debugCall().catch(console.error);
