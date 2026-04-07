export const getPostLoginRedirect = (locationState) => {
  const from = locationState?.from;

  if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/')) {
    return '/';
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return `${from.pathname}${search}${hash}`;
};
