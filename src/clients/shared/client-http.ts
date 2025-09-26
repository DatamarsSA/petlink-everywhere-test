const verificationLink =
  "https://develop.d7nqjmv4jqtf6.amplifyapp.com/verify-email?uuid=bc0e6389-a885-48a4-9518-a6037aae6b03&otp=88545&verificationId=df3e7047-216a-4e3a-b3b8-a664ec041533";
// Estrai i parametri dall'URL
const extractParamsFromUrl = (url: string) => {
  const urlObj = new URL(url);
  const uuid = urlObj.searchParams.get("uuid");
  const otp = urlObj.searchParams.get("otp");
  const verificationId = urlObj.searchParams.get("verificationId");

  return { uuid, otp, verificationId };
};

let params = extractParamsFromUrl(verificationLink);
console.log(params);
