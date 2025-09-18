import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { GraphQLClient } from "graphql-request";
import { getSdk as getCoreSkd } from "./lib/generated/core_schema.js";

const congnitoClient = new CognitoIdentityProviderClient({
  region: "eu-west-1",
});

const command = new InitiateAuthCommand({
  AuthFlow: "USER_PASSWORD_AUTH",
  ClientId: "7flcipunved2usfi0aq73pusu",
  AuthParameters: {
    USERNAME: "marco@test.it",
    PASSWORD: "Ciaokippy3!",
  },
});

const cognitoResponse = await congnitoClient.send(command);
console.log(`cognitoResponse: ${JSON.stringify(cognitoResponse, null, 2)}`);

const idToken = cognitoResponse.AuthenticationResult?.IdToken!;

const client = new GraphQLClient(
  "https://cmfkbxxb4jeuderfjcrrkubgmy.appsync-api.eu-west-1.amazonaws.com/graphql",
  {
    headers: {
      Authorization: idToken,
    },
  },
);
const sdk = getCoreSkd(client);

const result = await sdk.getUser();
console.log(`result: ${JSON.stringify(result.getUser, null, 2)}`);
