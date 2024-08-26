type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  expires?: Date;
};

export const mkCookie: (
  name: string,
  value: string,
  options?: CookieOptions,
) => string = (name, value, options = {}) => {
  let cookie = `${name}=${value}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.secure) cookie += "; Secure";
  if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  return cookie;
};
