// src/test-utils/environment.ts

import { User } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { env } from "../../config/env-schema-validation.js";
import {
  petlink,
  UtilityTestTypeEnum,
} from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { fixtures } from "../fixtures/fixtures.js";

export type GlobalState = {
  user?: User;
};

export class Store {
  private state: GlobalState = {};

  // Getter per lo stato corrente
  public getState(): GlobalState {
    return this.state;
  }

  /**
   * Pulisce l'ambiente eliminando utenti, email e messaggi SMS
   */
  public async cleanupAll(): Promise<void> {
    console.log("Cleaning up test environment");
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);

    await Promise.all([
      petlink.core.graphql.authIam
        .utilityIntegrationTest({
          input: {
            phone: fixtures.user.phone,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
          },
        })
        .then(() => console.log("Deleted User and all his related entity")),
      gmailClient
        .deleteAllEmails()
        .then(() => console.log("Deleted all emails")),
      twilioClient
        .deleteAllMessagesSentoToNumber(fixtures.user.phone)
        .then(() => console.log(`Deleted SMS for ${fixtures.user.phone}`)),
    ]);

    // Resetta lo stato
    this.state = {};
  }
}

// Esporta l'istanza singleton direttamente
export const globalState = new Store();
