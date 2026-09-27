// countryCurrency — country name -> ISO 4217 currency code, and the "is this currency in the
// ECB feed we already show" check (COUNTRY_VIEW_DISCUSSION.md: "No FX row unless the currency is
// in the ECB feed the site already uses"). The mapping itself is fixed public reference data
// (ISO 4217), the same kind of static lookup as shared/lib/countryMapping.js's region table —
// not a fact about current events, so it isn't subject to the "never invent facts" rule the way
// a price or a leader's name is. Coverage is deliberately partial: an unlisted country omits its
// FX row rather than guessing.
const COUNTRY_CURRENCY = {
  'United States': 'USD', 'United Kingdom': 'GBP', 'Japan': 'JPY', 'China': 'CNY',
  'India': 'INR', 'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR',
  'Netherlands': 'EUR', 'Belgium': 'EUR', 'Ireland': 'EUR', 'Austria': 'EUR', 'Portugal': 'EUR',
  'Greece': 'EUR', 'Finland': 'EUR', 'Slovakia': 'EUR', 'Slovenia': 'EUR', 'Estonia': 'EUR',
  'Latvia': 'EUR', 'Lithuania': 'EUR', 'Luxembourg': 'EUR', 'Cyprus': 'EUR', 'Malta': 'EUR',
  'Croatia': 'EUR', 'Canada': 'CAD', 'Mexico': 'MXN', 'Brazil': 'BRL', 'Argentina': 'ARS',
  'Russia': 'RUB', 'South Korea': 'KRW', 'North Korea': 'KPW', 'Australia': 'AUD',
  'New Zealand': 'NZD', 'South Africa': 'ZAR', 'Nigeria': 'NGN', 'Egypt': 'EGP',
  'Saudi Arabia': 'SAR', 'United Arab Emirates': 'AED', 'Israel': 'ILS', 'Turkey': 'TRY',
  'Iran': 'IRR', 'Iraq': 'IQD', 'Syria': 'SYP', 'Yemen': 'YER', 'Jordan': 'JOD',
  'Lebanon': 'LBP', 'Qatar': 'QAR', 'Kuwait': 'KWD', 'Pakistan': 'PKR', 'Bangladesh': 'BDT',
  'Indonesia': 'IDR', 'Philippines': 'PHP', 'Vietnam': 'VND', 'Thailand': 'THB',
  'Malaysia': 'MYR', 'Singapore': 'SGD', 'Switzerland': 'CHF', 'Sweden': 'SEK',
  'Norway': 'NOK', 'Denmark': 'DKK', 'Poland': 'PLN', 'Czechia': 'CZK', 'Czech Republic': 'CZK',
  'Hungary': 'HUF', 'Romania': 'RON', 'Bulgaria': 'BGN', 'Ukraine': 'UAH', 'Belarus': 'BYN',
  'Serbia': 'RSD', 'Colombia': 'COP', 'Venezuela': 'VES', 'Chile': 'CLP', 'Peru': 'PEN',
  'Ecuador': 'USD', 'Bolivia': 'BOB', 'Uruguay': 'UYU', 'Paraguay': 'PYG',
  'Kenya': 'KES', 'Ethiopia': 'ETB', 'Ghana': 'GHS', 'Morocco': 'MAD', 'Algeria': 'DZD',
  'Tunisia': 'TND', 'Libya': 'LYD', 'Sudan': 'SDG', 'Afghanistan': 'AFN', 'Sri Lanka': 'LKR',
  'Myanmar': 'MMK', 'Nepal': 'NPR', 'Taiwan': 'TWD', 'Hong Kong': 'HKD', 'Iceland': 'ISK',
  'Georgia': 'GEL', 'Armenia': 'AMD', 'Azerbaijan': 'AZN', 'Kazakhstan': 'KZT',
  'Uzbekistan': 'UZS', 'Mongolia': 'MNT', 'Cuba': 'CUP', 'Panama': 'USD', 'Zimbabwe': 'ZWL',
  'Somalia': 'SOS', 'South Sudan': 'SSP', 'Democratic Republic of the Congo': 'CDF',
  'Congo': 'CDF', 'Angola': 'AOA', 'Mozambique': 'MZN', 'Tanzania': 'TZS', 'Uganda': 'UGX',
};

export function currencyForCountry(name) {
  return COUNTRY_CURRENCY[name] || null;
}

/**
 * fxRowForCountry(countryName, fx) -> { currency, rate } | null
 * `fx` is the shape the markets_country proxy action returns: { rates: { CODE: number }, base }.
 * Returns null (no row) when the country's currency is unknown or not present in the fetched
 * rates — never a guessed/placeholder rate.
 */
export function fxRowForCountry(countryName, fx) {
  const currency = currencyForCountry(countryName);
  if (!currency || !fx?.rates) return null;
  const rate = fx.rates[currency];
  if (rate == null) return null;
  return { currency, rate, base: fx.base || 'USD' };
}
