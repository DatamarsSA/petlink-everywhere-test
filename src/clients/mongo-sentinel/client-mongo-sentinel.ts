import { MongoClient, ServerApiVersion } from "mongodb";
import { logger } from "../../config/logger.js";
import { fxt } from "../../fixtures/fixtures.js";

class MongoSentinelClient {
  private client: MongoClient;
  private isConnected = false;

  constructor() {
    const url = `mongodb+srv://${process.env.SENTINEL_MONGO_USER}:${process.env.SENTINEL_MONGO_PASSWORD}@${process.env.SENTINEL_MONGO_HOST}`;

    this.client = new MongoClient(url, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
  }

  private async connect(): Promise<void> {
    if (this.isConnected) return;

    logger.debug("→ Connecting to Sentinel MongoDB");
    await this.client.connect();
    this.isConnected = true;
    logger.debug("✓ Connected to Sentinel MongoDB");
  }

  async cleanupTestDevices(): Promise<void> {
    try {
      await this.connect();

      const db = this.client.db(process.env.SENTINEL_MONGO_DATABASE);

      // Raccogli tutti i serial numbers da fixtures
      const testSerialNumbers = [
        ...Object.values(fxt.KIPPY.devices).map((d) => d.serialNumber),
        ...Object.values(fxt.PETLINK.devices).map((d) => d.serialNumber),
      ];

      const filter = { serial_number: { $in: testSerialNumbers } };

      logger.debug("→ Cleaning test devices from Sentinel MongoDB", { testSerialNumbers });

      const [sentinelResult, podMappingResult] = await Promise.all([
        db.collection("sentinel").deleteMany(filter),
        db.collection("devicePodMapping").deleteMany(filter),
      ]);

      logger.debug("✓ Sentinel MongoDB cleanup completed", {
        sentinelDeleted: sentinelResult.deletedCount,
        podMappingDeleted: podMappingResult.deletedCount,
      });
    } catch (error: any) {
      const errorMessage = `Sentinel MongoDB cleanup failed: ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}

export const mongoSentinelClient = new MongoSentinelClient();

