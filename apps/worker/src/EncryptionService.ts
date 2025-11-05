import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptedSessionPayload, DecryptedSessionPayload, AppError, ErrorCodes } from '@ig-analytics/shared';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES-256-CBC

/**
 * Service class to handle encryption and decryption of sensitive session data.
 * Uses AES-256-CBC with a user-provided 32-byte hex key.
 */
export class EncryptionService {
  private encryptionKey: Buffer;

  /**
   * @param encryptionKeyHex The 32-byte hex-encoded encryption key.
   */
  constructor(encryptionKeyHex: string) {
    if (encryptionKeyHex.length !== 64) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        'Encryption key must be a 32-byte (64 hex characters) hex string.',
        500
      );
    }
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
  }

  /**
   * Encrypts the session payload object.
   * @param payload The session payload to encrypt.
   * @returns The encrypted payload object.
   */
  public encrypt(payload: DecryptedSessionPayload): EncryptedSessionPayload {
    try {
      const text = JSON.stringify(payload);
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        algorithm: ALGORITHM,
      };
    } catch (error) {
      throw new AppError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to encrypt session payload.',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Decrypts the encrypted session payload object.
   * @param encryptedPayload The encrypted payload object.
   * @returns The decrypted session payload object.
   */
  public decrypt(encryptedPayload: EncryptedSessionPayload): DecryptedSessionPayload {
    try {
      if (encryptedPayload.algorithm !== ALGORITHM) {
        throw new Error('Unsupported encryption algorithm.');
      }

      const iv = Buffer.from(encryptedPayload.iv, 'hex');
      const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      let decrypted = decipher.update(encryptedPayload.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as DecryptedSessionPayload;
    } catch (error) {
      throw new AppError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to decrypt session payload. Key or payload may be corrupt.',
        500,
        { originalError: error }
      );
    }
  }
}
