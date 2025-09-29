export const getAuthTokenCookie = (cookie: string | null) => {
  const cookiesObject = cookie
    ?.split(";")
    .filter((x) => x.includes("="))
    .map((x) => x.trim().split("=") as [string, string])
    .reduce(
      (previous, [key, value]) => ({ ...previous, [key]: value }),
      {} as { [key: string]: string },
    );
  const authToken = cookiesObject?.authToken;
  return authToken;
};
