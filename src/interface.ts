//https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
export interface entraIdTokenPayload {
  aud: string;
  iss: string;
  iat: number;
  idp: string;
  nbf: number;
  exp: number;
  c_hash: string;
  at_hash: string;
  aio: string;
  preferred_username: string;
  email: string;
  name: string;
  nonce: string;
  oid: string;
  roles: string[];
  rh: string;
  sub: string;
  tid: string;
  unique_name?: string;
  uti: string;
  ver: string;
  hasgroups: boolean;
}
