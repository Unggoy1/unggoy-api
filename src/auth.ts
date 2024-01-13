// import { entraId } from "./lucia";
// import { MicrosoftEntraIdTokens } from "arctic";
//
// enum XstsRelayingParty {
//   XboxAudience = "http://xboxlive.com",
//   HaloAudience = "https://prod.xsts.halowaypoint.com/",
// }
//
// type XboxToken = {
//   DisplayClaims: {
//     xui: {
//       uhs: string;
//       xid?: string;
//       gtg?: string;
//     }[];
//   };
//   IssueInstant: string;
//   NotAfter: string;
//   Token: string;
// };
// type SpartanToken = {
//   ExpiresUtc: {
//     ISO8601Date: string;
//   };
//   SpartanToken: string;
//   TokenDuration: string;
// };
//
// type Spartan = {
//   xuid: string;
//   gamertag: string;
//   spartanToken: SpartanToken;
//   refreshToken: string;
// };
//
// export async function refreshSpartanToken(
//   refreshToken: string,
// ): Promise<Spartan> {
//   const oauth_tokens: MicrosoftEntraIdTokens =
//     await entraId.refreshAccessToken(refreshToken);
//
//   //call to get xbox user token
//   const userToken = await requestUserToken(oauth_tokens.accessToken);
//
//   //call to get XSTS Xbox token
//   const xstsToken = await requestXstsToken(
//     userToken.Token,
//     XstsRelayingParty.XboxAudience,
//   );
//
//   //call to get XSTS Halo Token
//   const haloXstsToken = await requestXstsToken(
//     userToken.Token,
//     XstsRelayingParty.HaloAudience,
//   );
//
//   //call to get spartan token
//   const spartanToken = await requestSpartanToken(haloXstsToken.Token);
//
//   //call to get request clearance token should be optional for our use
//   //const clearanceToken = await requestClearanceToken(spartanToken.SpartanToken);
//
//   return {
//     xuid: xstsToken.DisplayClaims.xui[0].xid!,
//     gamertag: xstsToken.DisplayClaims.xui[0].gtg!,
//     spartanToken: spartanToken,
//     refreshToken: oauth_tokens.refreshToken!,
//     //xbl_authorization_header_value = xstsToken.authorization_header_value
//   };
// }
//
// export async function requestUserToken(
//   accessToken: string,
// ): Promise<XboxToken> {
//   const apiEndpoint = "https://user.auth.xboxlive.com/user/authenticate"; // Replace with your actual API endpoint
//
//   const postData = {
//     Properties: {
//       AuthMethod: "RPS",
//       RpsTicket: `d=${accessToken}`,
//       SiteName: "user.auth.xboxlive.com",
//     },
//     RelyingParty: "http://auth.xboxlive.com",
//     TokenType: "JWT",
//   };
//
//   try {
//     const response = await fetch(apiEndpoint, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-xbl-contract-version": "1",
//         // You can add additional headers here if needed
//       },
//       //settings.svc.halowaypoint.com/spartan-token
//       body: JSON.stringify(postData),
//     });
//
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }
//
//     const data: XboxToken = (await response.json()) as XboxToken;
//     return data;
//   } catch (error) {
//     throw error;
//   }
// }
//
// export async function requestXstsToken(
//   accessToken: string,
//   xstsRelayingParty: XstsRelayingParty,
// ): Promise<XboxToken> {
//   const apiEndpoint = "https://xsts.auth.xboxlive.com/xsts/authorize";
//   const postData = {
//     Properties: {
//       SandboxId: "RETAIL",
//       UserTokens: [accessToken],
//     },
//     RelyingParty: xstsRelayingParty,
//     TokenType: "JWT",
//   };
//   try {
//     const response = await fetch(apiEndpoint, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-xbl-contract-version": "1",
//         // You can add additional headers here if needed
//       },
//       body: JSON.stringify(postData),
//     });
//
//     if (!response.ok) {
//       //TODO Figure out if this is because the user doesn't have an xbox account yet to report to front end..
//       console.error(response);
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }
//     const data: any = await response.json();
//     return data;
//   } catch (error) {
//     throw error;
//   }
// }
//
// export async function requestSpartanToken(
//   accessToken: string,
// ): Promise<SpartanToken> {
//   const apiEndpoint = "https://settings.svc.halowaypoint.com/spartan-token";
//   const postData = {
//     Audience: "urn:343:s3:services",
//     MinVersion: "4",
//     Proof: [
//       {
//         Token: accessToken,
//         TokenType: "Xbox_XSTSv3",
//       },
//     ],
//   };
//   try {
//     const response = await fetch(apiEndpoint, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         // You can add additional headers here if needed
//       },
//       body: JSON.stringify(postData),
//     });
//
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }
//
//     const data: SpartanToken = (await response.json()) as SpartanToken;
//     return data;
//   } catch (error) {
//     throw error;
//   }
// }
//
// export async function requestClearanceToken(
//   accessToken: string,
// ): Promise<SpartanToken> {
//   const apiEndpoint = "https://settings.svc.halowaypoint.com/";
//   const postData = {
//     Audience: "urn:343:s3:services",
//     MinVersion: "4",
//     Proof: [
//       {
//         Token: accessToken,
//         TokenType: "Xbox_XSTSv3",
//       },
//     ],
//   };
//   try {
//     const response = await fetch(apiEndpoint, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         // You can add additional headers here if needed
//       },
//       body: JSON.stringify(postData),
//     });
//
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }
//
//     const data: SpartanToken = (await response.json()) as SpartanToken;
//     return data;
//   } catch (error) {
//     throw error;
//   }
// }
