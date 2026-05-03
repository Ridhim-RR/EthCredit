/**
 * 0G Storage Service
 *
 * Integrates with 0G Storage network via @0gfoundation/0g-storage-ts-sdk
 *
 * Interface:
 *   upload(payload) → { txHash, rootHash }
 *   download(rootHash) → payload
 */

const { Indexer, ZgFile } = require('@0gfoundation/0g-storage-ts-sdk');
const { ethers } = require('ethers');
const fs = require('fs');
const crypto = require('crypto');

// Configuration
const storageRpc = process.env.ZERO_G_STORAGE_RPC || 'https://rpc-testnet.0g.ai';
const indexerRpc = process.env.ZERO_G_INDEXER_RPC || 'https://indexer-storage-testnet-standard.0g.ai';
const privateKey = process.env.ZERO_G_PRIVATE_KEY;

let _indexer = null;
function getIndexer() {
    if (!_indexer) {
        _indexer = new Indexer(indexerRpc);
    }
    return _indexer;
}

/**
 * Store a payload in 0G Storage.
 * @param {Object} payload 
 * @returns {Promise<{txHash: string, rootHash: string}>}
 */
async function upload(payload) {
    if (!privateKey) throw new Error('ZERO_G_PRIVATE_KEY is missing');
    
    // Setup signer
    const provider = new ethers.JsonRpcProvider(storageRpc);
    const signer = new ethers.Wallet(privateKey, provider);
    
    // Create temp file for SDK
    const tempFileName = `/tmp/0g-upload-${crypto.randomBytes(8).toString('hex')}.json`;
    fs.writeFileSync(tempFileName, JSON.stringify(payload));
    
    try {
        const file = await ZgFile.fromFilePath(tempFileName);
        const indexer = getIndexer();
        
        // Upload
        const [result, err] = await indexer.upload(file, storageRpc, signer);
        if (err) throw err;

        let txHash, rootHash;
        if (result.txHashes) {
            txHash = result.txHashes[0];
            rootHash = result.rootHashes[0];
        } else {
            txHash = result.txHash;
            rootHash = result.rootHash;
        }

        return { txHash, rootHash };
    } finally {
        // Cleanup temp file
        if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
        }
    }
}

/**
 * Downloads payload from 0G Storage by rootHash
 * @param {string} rootHash
 * @returns {Promise<Object>}
 */
async function download(rootHash) {
    const tempFileName = `/tmp/0g-download-${crypto.randomBytes(8).toString('hex')}.json`;
    try {
        const indexer = getIndexer();
        await indexer.download(rootHash, tempFileName);
        
        const content = fs.readFileSync(tempFileName, 'utf8');
        return JSON.parse(content);
    } finally {
        if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
        }
    }
}

module.exports = {
    upload,
    download
};
