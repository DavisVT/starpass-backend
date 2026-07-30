import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly serverMasterKey: Buffer;
  private readonly serverKeypair: crypto.X25519KeyPair;

  constructor(private configService: ConfigService) {
    const masterKeyHex = this.configService.get<string>('SERVER_MASTER_KEY') || process.env.SERVER_MASTER_KEY!;
    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error('SERVER_MASTER_KEY must be a 32-byte hex string (64 characters)');
    }
    this.serverMasterKey = Buffer.from(masterKeyHex, 'hex');

    const serverPrivateKeyHex = this.configService.get<string>('SERVER_X25519_PRIVATE_KEY') || process.env.SERVER_X25519_PRIVATE_KEY!;
    if (!serverPrivateKeyHex || serverPrivateKeyHex.length !== 64) {
      throw new Error('SERVER_X25519_PRIVATE_KEY must be a 32-byte hex string (64 characters)');
    }
    this.serverKeypair = crypto.createX25519KeyPairFromSeed(Buffer.from(serverPrivateKeyHex, 'hex'));
  }

  generateAes256GcmKey(): Buffer {
    return crypto.randomBytes(32);
  }

  encryptWithAes256Gcm(plaintext: Buffer, key: Buffer): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  decryptWithAes256Gcm(ciphertext: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  encryptKeyWithMasterKey(plaintextKey: Buffer): string {
    const { ciphertext, iv, authTag } = this.encryptWithAes256Gcm(plaintextKey, this.serverMasterKey);
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decryptKeyWithMasterKey(encryptedKeyBase64: string): Buffer {
    const encryptedData = Buffer.from(encryptedKeyBase64, 'base64');
    const iv = encryptedData.subarray(0, 12);
    const authTag = encryptedData.subarray(12, 12 + 16);
    const ciphertext = encryptedData.subarray(12 + 16);
    return this.decryptWithAes256Gcm(ciphertext, this.serverMasterKey, iv, authTag);
  }

  // Convert Ed25519 public key (Stellar address's raw key) to X25519 public key
  convertEd25519PublicKeyToX25519(ed25519PublicKey: Buffer): Buffer {
    // The Ed25519 public key is a 32-byte point in Montgomery form
    // For conversion, we can use the raw bytes as per standard conversion
    return ed25519PublicKey;
  }

  wrapKeyWithFanPublicKey(contentKey: Buffer, fanEd25519PublicKey: Buffer): { wrappedKey: string; serverPublicKey: string; nonce: string } {
    const fanX25519PublicKey = this.convertEd25519PublicKeyToX25519(fanEd25519PublicKey);
    
    const sharedSecret = this.serverKeypair.privateKey.deriveSecret(
      crypto.createPublicKey({
        key: fanX25519PublicKey,
        format: 'raw',
        type: 'public',
      })
    );
    
    const nonce = crypto.randomBytes(24);
    
    const cipher = crypto.createCipheriv('xchacha20-poly1305', sharedSecret, nonce);
    const wrappedKey = Buffer.concat([cipher.update(contentKey), cipher.final(), cipher.getAuthTag()]);
    
    return {
      wrappedKey: wrappedKey.toString('base64'),
      serverPublicKey: this.serverKeypair.publicKey.export({ format: 'raw', type: 'public' }).toString('base64'),
      nonce: nonce.toString('base64'),
    };
  }

  // Helper to extract raw Ed25519 public key from Stellar address (G...)
  getRawEd25519PublicKeyFromStellarAddress(address: string): Buffer {
    if (!address.startsWith('G')) {
      throw new BadRequestException('Invalid Stellar address');
    }
    // Stellar addresses are base32 encoded, let's decode
    // @stellar/stellar-sdk has StrKey class for this
    const { StrKey } = require('@stellar/stellar-sdk');
    return Buffer.from(StrKey.decodeEd25519PublicKey(address));
  }
}
