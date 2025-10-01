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
   * Elimina l'utente corrente
   */
  public async deleteUser(): Promise<void> {
    if (!this.state.user) {
      console.log("No user to delete in the current state");
      try {
        await petlink.loginWithPhone(
          fixtures.user.phone,
          fixtures.user.password,
        );
        const user = await petlink.core.authJwt.getUser();

        petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
        await petlink.core.authIam.utilityIntegrationTest({
          input: {
            userId: user.getUser.user!.id,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
          },
        });

        console.log(`Deleted default user with ID: ${user.getUser.user!.id}`);
      } catch (error) {
        // Silently ignore if user doesn't exist (expected in first run)
      }

      return;
    }
  }

  /**
   * Pulisce l'ambiente eliminando utenti, email e messaggi SMS
   */
  public async cleanupAll(): Promise<void> {
    console.log("Cleaning up test environment");
    
    // Esegui tutte le operazioni di cleanup in parallelo
    await Promise.all([
      this.deleteUser(),
      gmailClient.deleteAllEmails().then(() => console.log("Deleted all emails")),
      twilioClient.deleteAllMessagesSentoToNumber(fixtures.user.phone)
        .then(() => console.log(`Deleted SMS for ${fixtures.user.phone}`))
    ]);
    
    // Resetta lo stato
    this.state = {};
  }
}

// Esporta l'istanza singleton direttamente
export const globalState = new Store();
