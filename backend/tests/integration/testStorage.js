require('dotenv').config();
const zeroGStorage = require('../../src/services/zeroGStorageService');

async function run() {
    try {
        console.log("Testing 0G Storage Upload...");
        const payload = {
            type: "TEST",
            message: "hello 0g",
            timestamp: new Date().toISOString()
        };

        console.log("Payload:", payload);
        const { txHash, rootHash } = await zeroGStorage.upload(payload);
        
        console.log("Upload Success!");
        console.log("txHash:", txHash);
        console.log("rootHash:", rootHash);

    } catch (err) {
        console.error("Test failed:", err);
    }
}

run();
