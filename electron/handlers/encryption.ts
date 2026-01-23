import crypto from 'node:crypto'

export class EncryptionManager {
    private static ITERATIONS = 100000
    private static KEY_LEN = 32 // 256 bits
    private static ALGO = 'aes-256-gcm'

    private encryptionKey: Buffer | null = null

    /**
     * Sets the master password and derives the encryption key.
     * In a production app, we should also store a hash/verifier to validate the password.
     */
    async setMasterPassword(password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Using a static salt for simplicity in this demo, 
            // but usually we'd store a unique salt per installation.
            const salt = 'macscp-static-salt'
            crypto.pbkdf2(password, salt, EncryptionManager.ITERATIONS, EncryptionManager.KEY_LEN, 'sha256', (err, derivedKey) => {
                if (err) reject(err)
                this.encryptionKey = derivedKey
                resolve()
            })
        })
    }

    clear(): void {
        this.encryptionKey = null
    }

    isUnlocked(): boolean {
        return this.encryptionKey !== null
    }

    encrypt(text: string): string {
        if (!this.encryptionKey) throw new Error('Master password not set')

        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv(EncryptionManager.ALGO, this.encryptionKey, iv) as crypto.CipherGCM

        let encrypted = cipher.update(text, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        const authTag = cipher.getAuthTag().toString('hex')

        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag}:${encrypted}`
    }

    decrypt(encryptedData: string): string {
        if (!this.encryptionKey) throw new Error('Master password not set')

        const [ivHex, authTagHex, encryptedText] = encryptedData.split(':')
        if (!ivHex || !authTagHex || !encryptedText) {
            // If it's not in our format, it might be plain text (backwards compat)
            return encryptedData
        }

        const iv = Buffer.from(ivHex, 'hex')
        const authTag = Buffer.from(authTagHex, 'hex')
        const decipher = crypto.createDecipheriv(EncryptionManager.ALGO, this.encryptionKey, iv) as crypto.DecipherGCM

        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    }
}

export const encryptionManager = new EncryptionManager()
