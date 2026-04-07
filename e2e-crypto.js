/**
 * E2E encryption for ByteNexus personal messages.
 * Uses Web Crypto API: ECDH P-256 for key exchange, AES-GCM for encryption.
 * Encrypted format: "E2E:" + base64(JSON.stringify({iv, ct}))
 *
 * Private keys are stored per-user in localStorage AND backed up to the server
 * so decryption works on any device the student logs into.
 */
const E2E_Crypto = (function() {
    const E2E_PREFIX = 'E2E:';

    function storageKey(userId) {
        return 'schoolbyte_chat_priv_' + userId;
    }

    async function generateKeyPair() {
        return crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits']
        );
    }

    async function exportPublicKey(keyPair) {
        const raw = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        return btoa(String.fromCharCode(...new Uint8Array(raw)));
    }

    async function importPublicKey(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return crypto.subtle.importKey(
            'spki',
            bytes.buffer,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
    }

    async function deriveAesKey(ourPrivateKey, theirPublicKey) {
        const sharedBits = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: theirPublicKey },
            ourPrivateKey,
            256
        );
        return crypto.subtle.importKey(
            'raw',
            sharedBits,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    function stringToBytes(str) {
        return new TextEncoder().encode(str);
    }

    function bytesToString(bytes) {
        return new TextDecoder().decode(bytes);
    }

    let privateKeyCrypto = null;
    let currentUserId = null;

    async function fetchPrivateKeyBackupFromServer(apiUrl, token) {
        try {
            const res = await fetch(`${apiUrl}/api/students/me/chat-private-key-backup`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.privateKeyBackup || null;
        } catch (e) {
            return null;
        }
    }

    async function savePrivateKeyBackupToServer(jwkString, apiUrl, token) {
        try {
            await fetch(`${apiUrl}/api/students/me/chat-private-key-backup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ privateKeyBackup: jwkString })
            });
        } catch (e) {
            console.warn('E2E: Failed to backup private key to server', e);
        }
    }

    async function ensureKeyPair(userId, apiUrl, token) {
        if (privateKeyCrypto && currentUserId === userId) return privateKeyCrypto;
        currentUserId = userId;
        const KEY = storageKey(userId);
        const stored = localStorage.getItem(KEY);

        if (stored) {
            try {
                const jwk = JSON.parse(stored);
                privateKeyCrypto = await crypto.subtle.importKey(
                    'jwk',
                    jwk,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    ['deriveBits']
                );
                return privateKeyCrypto;
            } catch (e) {
                console.warn('E2E: Stored key load failed, trying server backup', e);
            }
        }

        // Try to restore from server backup
        const serverBackup = await fetchPrivateKeyBackupFromServer(apiUrl, token);
        if (serverBackup) {
            try {
                const jwk = JSON.parse(serverBackup);
                privateKeyCrypto = await crypto.subtle.importKey(
                    'jwk',
                    jwk,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    ['deriveBits']
                );
                localStorage.setItem(KEY, serverBackup);
                console.log('E2E: Restored private key from server backup');
                return privateKeyCrypto;
            } catch (e) {
                console.warn('E2E: Server backup key load failed, generating new pair', e);
            }
        }

        // Generate new key pair
        const keyPair = await generateKeyPair();
        const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const privJwkString = JSON.stringify(privJwk);
        localStorage.setItem(KEY, privJwkString);
        privateKeyCrypto = keyPair.privateKey;

        // Upload public key
        const pubB64 = await exportPublicKey(keyPair);
        try {
            await fetch(`${apiUrl}/api/students/me/chat-public-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ publicKey: pubB64 })
            });
        } catch (err) {
            console.warn('E2E: Failed to upload public key', err);
        }

        // Backup private key to server
        await savePrivateKeyBackupToServer(privJwkString, apiUrl, token);

        return privateKeyCrypto;
    }

    return {
        E2E_PREFIX,
        isEncrypted: (s) => typeof s === 'string' && s.startsWith(E2E_PREFIX),

        async init(userId, apiUrl, token) {
            if (!userId || !apiUrl || !token) return;
            try {
                await ensureKeyPair(userId, apiUrl, token);
            } catch (e) {
                console.warn('E2E init failed:', e);
            }
        },

        async encrypt(recipientId, plaintext, apiUrl, token) {
            try {
                const res = await fetch(`${apiUrl}/api/students/${recipientId}/chat-public-key`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!data || !data.publicKey) return plaintext;
                const theirPubKey = await importPublicKey(data.publicKey);
                await ensureKeyPair(currentUserId, apiUrl, token);
                const aesKey = await deriveAesKey(privateKeyCrypto, theirPubKey);
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const ct = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv, tagLength: 128 },
                    aesKey,
                    stringToBytes(plaintext)
                );
                const ivB64 = btoa(String.fromCharCode.apply(null, iv));
                const ctB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(ct)));
                return E2E_PREFIX + btoa(JSON.stringify({ iv: ivB64, ct: ctB64 }));
            } catch (e) {
                console.warn('E2E encrypt failed, sending plain:', e);
                return plaintext;
            }
        },

        async decrypt(senderId, encrypted, apiUrl, token) {
            if (!this.isEncrypted(encrypted)) return encrypted;
            try {
                const payload = encrypted.slice(E2E_PREFIX.length);
                const decoded = JSON.parse(atob(payload));
                const iv = new Uint8Array(atob(decoded.iv).split('').map(c => c.charCodeAt(0)));
                const ct = new Uint8Array(atob(decoded.ct).split('').map(c => c.charCodeAt(0)));
                const res = await fetch(`${apiUrl}/api/students/${senderId}/chat-public-key`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!data || !data.publicKey) return '[Encrypted — sender key unavailable]';
                const theirPubKey = await importPublicKey(data.publicKey);
                await ensureKeyPair(currentUserId, apiUrl, token);
                const aesKey = await deriveAesKey(privateKeyCrypto, theirPubKey);
                const dec = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv, tagLength: 128 },
                    aesKey,
                    ct
                );
                return bytesToString(dec);
            } catch (e) {
                console.warn('E2E decrypt failed:', e);
                return '🔒 [Encrypted message]';
            }
        }
    };
})();
