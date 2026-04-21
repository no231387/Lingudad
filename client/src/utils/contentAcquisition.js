const normalizeText = (value) => String(value || '').trim();

export const splitCsvValues = (value) =>
  [...new Set(normalizeText(value).split(',').map((entry) => entry.trim()).filter(Boolean))];

export const buildContentAcquisitionPayload = ({ formState, user, defaultLimit = 4 }) => {
  const payload = {
    studyQuery: normalizeText(formState.studyQuery),
    language: normalizeText(formState.language || user?.language || 'Japanese'),
    level: normalizeText(formState.level || user?.level || ''),
    preferredTopics: splitCsvValues(formState.preferredTopics),
    preferredRegister: splitCsvValues(formState.preferredRegister),
    goals: Array.isArray(user?.goals) ? user.goals.filter(Boolean) : [],
    limit: defaultLimit
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== '';
    })
  );
};

export const summarizeContentAcquisitionResult = (result) => {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const readyNow = candidates.filter((candidate) => candidate.recommendationEligible === true);
  const addedButNotReady = candidates.filter((candidate) => candidate.contentId && candidate.recommendationEligible !== true);
  const addedCount = Number(result?.createdCount || 0);
  const reusedCount = Number(result?.reusedCount || 0);

  if (readyNow.length > 0) {
    return {
      tone: 'success',
      title: `${readyNow.length} ${readyNow.length === 1 ? 'item is' : 'items are'} ready to practice`,
      summary:
        addedCount > 0
          ? `${addedCount} ${addedCount === 1 ? 'new item was' : 'new items were'} added to Discover.`
          : 'Ready content is now available in Discover.',
      facts: [
        `${readyNow.length} ready now`,
        `${addedButNotReady.length} ${addedButNotReady.length === 1 ? 'item needs' : 'items need'} more processing`,
        reusedCount > 0 ? `${reusedCount} ${reusedCount === 1 ? 'existing item was' : 'existing items were'} rechecked` : ''
      ].filter(Boolean)
    };
  }

  if (addedButNotReady.length > 0) {
    return {
      tone: 'neutral',
      title: 'Content was found, but nothing is ready yet',
      summary:
        addedCount > 0
          ? `${addedCount} ${addedCount === 1 ? 'item was added' : 'items were added'} for follow-up processing.`
          : 'We checked matching content, but it still needs more grounding before it is ready.',
      facts: [
        `${addedButNotReady.length} ${addedButNotReady.length === 1 ? 'item is' : 'items are'} still processing`,
        reusedCount > 0 ? `${reusedCount} ${reusedCount === 1 ? 'existing item was' : 'existing items were'} rechecked` : ''
      ].filter(Boolean),
      suggestion: 'Try a broader study query if you want more options.'
    };
  }

  return {
    tone: 'neutral',
    title: 'No matching content was added',
    summary: 'Try a broader study query or a less specific topic.',
    facts: [Number(result?.sourcedCount || 0) > 0 ? `${Number(result.sourcedCount)} candidates were checked` : 'No matching candidates found'].filter(Boolean)
  };
};
