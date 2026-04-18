export const normalizeRecommendationItems = (items) => (Array.isArray(items) ? items : []);

export const normalizeRecommendationResponse = (payload) => {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: null
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      items: [],
      meta: null
    };
  }

  return {
    items: normalizeRecommendationItems(payload.items),
    meta: payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : null
  };
};
