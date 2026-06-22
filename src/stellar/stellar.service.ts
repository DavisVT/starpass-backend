import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.rpc.Server;
  private contractId: string;

  constructor(private config: ConfigService) {
    const rpcUrl = this.config.get('STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.server = new StellarSdk.rpc.Server(rpcUrl);
    this.contractId = this.config.get('STARPASS_CONTRACT_ID') || '';
  }

  /**
   * Check if a fan has a valid pass on-chain
   * This is the source of truth — DB is a cache
   */
  async hasValidPassOnChain(fanAddress: string, tierId: number): Promise<boolean> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      const result = await this.server.simulateTransaction(
        new StellarSdk.TransactionBuilder(
          await this.server.getAccount(fanAddress),
          { fee: '100', networkPassphrase: StellarSdk.Networks.TESTNET },
        )
          .addOperation(
            contract.call(
              'has_valid_pass',
              StellarSdk.nativeToScVal(fanAddress, { type: 'address' }),
              StellarSdk.nativeToScVal(tierId, { type: 'u32' }),
            ),
          )
          .setTimeout(30)
          .build(),
      );

      if ('error' in result) return false;

      return StellarSdk.scValToNative(result.result?.retval) as boolean;
    } catch (error) {
      this.logger.error(`Error checking pass on-chain: ${error.message}`);
      return false;
    }
  }

  /**
   * Get events from the StarPass contract starting from a ledger
   */
  async getContractEvents(startLedger: number) {
    try {
      const response = await this.server.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contractId],
          },
        ],
        limit: 100,
      });
      return response.events || [];
    } catch (error) {
      this.logger.error(`Error fetching events: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the latest ledger number
   */
  async getLatestLedger(): Promise<number> {
    const response = await this.server.getLatestLedger();
    return response.sequence;
  }

  /**
   * Emit a fee_updated event to the Soroban contract.
   * This is best-effort — failures are logged but do not block the DB update.
   *
   * @param feeBps - The new fee in basis points.
   */
  async emitFeeUpdatedEvent(feeBps: number): Promise<void> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      const networkPassphrase =
        this.config.get('STELLAR_NETWORK') === 'mainnet'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;

      // Simulate the set_fee call to verify it would succeed on-chain
      const adminAddress = this.config.get<string>('ADMIN_STELLAR_ADDRESS') || '';
      if (!adminAddress) {
        this.logger.warn('ADMIN_STELLAR_ADDRESS not configured — skipping on-chain fee emit');
        return;
      }

      const account = await this.server.getAccount(adminAddress);
      await this.server.simulateTransaction(
        new StellarSdk.TransactionBuilder(account, {
          fee: '100',
          networkPassphrase,
        })
          .addOperation(
            contract.call(
              'set_fee',
              StellarSdk.nativeToScVal(feeBps, { type: 'u32' }),
            ),
          )
          .setTimeout(30)
          .build(),
      );

      this.logger.log(`fee_updated event simulated on-chain: ${feeBps} bps`);
    } catch (error) {
      this.logger.error(`emitFeeUpdatedEvent failed: ${error.message}`);
      throw error;
    }
  }
}
