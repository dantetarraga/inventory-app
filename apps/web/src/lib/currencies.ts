export const CURRENCIES = [
  { code: 'PEN', name: 'Sol peruano', country: 'PE' },
  { code: 'USD', name: 'Dólar estadounidense', country: 'US' },
  { code: 'EUR', name: 'Euro', country: 'ES' },
  { code: 'MXN', name: 'Peso mexicano', country: 'MX' },
  { code: 'COP', name: 'Peso colombiano', country: 'CO' },
  { code: 'CLP', name: 'Peso chileno', country: 'CL' },
  { code: 'ARS', name: 'Peso argentino', country: 'AR' },
  { code: 'BOB', name: 'Boliviano', country: 'BO' },
] as const;

export const COUNTRIES = [
  { code: 'PE', name: 'Perú' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'ES', name: 'España' },
  { code: 'MX', name: 'México' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CL', name: 'Chile' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'EC', name: 'Ecuador' },
] as const;
