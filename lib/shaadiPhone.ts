const SHAADI_PHONES = ['7646028228', '9942972484'];

export function getShaadiPhone(vendorId: string) {
  const sum = vendorId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SHAADI_PHONES[sum % SHAADI_PHONES.length];
}
