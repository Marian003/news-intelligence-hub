/** The minimal authenticated identity attached to a request by the guard. */
export interface AuthedUser {
  userId: string;
  email: string;
}

/** Claims we put in the JWT. `sub` is the user id; `jti` enables logout. */
export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
}

/** A JWT payload after verification, including the standard timestamp claims. */
export type VerifiedJwtPayload = JwtPayload & {iat: number; exp: number};
