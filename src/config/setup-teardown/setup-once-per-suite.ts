import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

export default async function setup() {
  console.log("----- INIZIO SUITE (globalSetup) -----");
  // una volta PRIMA di tutta la run
  // await petlink.deleteUser();

  // ritorna la funzione di teardown UNA volta a FINE run
  return async () => {
    console.log("----- FINE SUITE (global teardown) -----");
    // await petlink.deleteUser();
  };
}
