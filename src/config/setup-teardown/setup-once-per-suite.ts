export default async function setup() {
  // una volta PRIMA di tutta la run
  // console.log("----- INIZIO SUITE (globalSetup) -----");

  // ritorna la funzione di teardown UNA volta a FINE run
  return async () => {
    // console.log("----- FINE SUITE (global teardown) -----");
  };
}
