import { z, ZodError } from "zod";

/**
 * Construct a fetcher that parses the response as a zod type
 * @param zType - The zod type to parse the response as, defaults to `void`
 * @returns A fetch function that returns a promise of the parsed response
 */
export const fetcher: <T extends z.ZodTypeAny>(
  zType: T,
) => (...args: Parameters<typeof fetch>) => Promise<z.infer<T>> =
  (zType) =>
  (url, ...args) =>
    fetch(url, ...args)
      .then((res) => res.json())
      .then((data) => zType.parse(data))
      .catch(handleFetchErrors(url));

const handleFetchErrors: (
  url: Parameters<typeof fetch>[0],
) => (e: Error) => void = (url) => (e) => {
  if (e instanceof ZodError) {
    console.error(e, url, e.errors);
  } else {
    console.error(e);
  }
  throw e;
};
