import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /**
   * Verify a Stellar signature and issue a JWT.
   * The client signs a challenge message with their Stellar keypair.
   */
  async login(stellarAddress: string, signature: string, message: string) {
    // Verify the signature against the Stellar address
    const isValid = this.verifySignature(stellarAddress, message, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Upsert the user
    const user = await this.prisma.user.upsert({
      where: { stellarAddress },
      update: {},
      create: { stellarAddress },
    });

    const token = this.jwt.sign({
      sub: user.id,
      address: user.stellarAddress,
      role: user.role,
    });

    return { token, user };
  }

  /**
   * Generate a challenge message for the client to sign
   */
  getChallenge(stellarAddress: string): string {
    const timestamp = Date.now();
    return `StarPass authentication challenge for ${stellarAddress} at ${timestamp}`;
  }

  /**
   * Verify a Stellar keypair signature
   */
  private verifySignature(
    stellarAddress: string,
    message: string,
    signature: string,
  ): boolean {
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(stellarAddress);
      const messageBytes = Buffer.from(message, 'utf8');
      const signatureBytes = Buffer.from(signature, 'base64');
      return keypair.verify(messageBytes, signatureBytes);
    } catch {
      return false;
    }
  }

  /**
   * Validate a JWT and return the user
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwt.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      return user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
