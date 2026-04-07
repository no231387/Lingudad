export const updateStudyQueue = (cards, currentIndex, rating) => {
  const queue = Array.isArray(cards) ? [...cards] : [];

  if (queue.length === 0 || currentIndex < 0 || currentIndex >= queue.length) {
    return {
      cards: queue,
      nextIndex: 0
    };
  }

  const [currentCard] = queue.splice(currentIndex, 1);

  if (!currentCard) {
    return {
      cards: queue,
      nextIndex: 0
    };
  }

  if (rating === 'again') {
    const requeueIndex = Math.min(2, queue.length);
    queue.splice(requeueIndex, 0, currentCard);
    return {
      cards: queue,
      nextIndex: queue.length > 1 && currentIndex < queue.length ? currentIndex : 0
    };
  }

  return {
    cards: queue,
    nextIndex: queue.length === 0 ? 0 : Math.min(currentIndex, queue.length - 1)
  };
};
