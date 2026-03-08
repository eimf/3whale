import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALE_COOKIE = "NEXT_LOCALE";
const DEFAULT_LOCALE = "es-MX";
const SUPPORTED_LOCALES = ["es-MX", "en"] as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as (typeof SUPPORTED_LOCALES)[number])
      ? cookieLocale
      : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
  };
});
