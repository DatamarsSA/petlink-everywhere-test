import { GraphQLClient } from "graphql-request";
import { getSdk as getCoreSkd } from "./lib/generated/core_schema.js";

const client = new GraphQLClient(
  "https://cmfkbxxb4jeuderfjcrrkubgmy.appsync-api.eu-west-1.amazonaws.com/graphql",
  {
    headers: { "x-api-key": "da2-23pdcxbzffd2xjyubn7t22dsja" },
  },
);
const sdk = getCoreSkd(client);

const result = await sdk.getBreed({ species: "DOG" });
console.log(`getBreed: ${JSON.stringify(result.getBreed, null, 2)}`);
