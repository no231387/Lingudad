const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve('../controllers/dashboardController');
const deckPath = require.resolve('../models/Deck');
const flashcardPath = require.resolve('../models/Flashcard');
const learningContentPath = require.resolve('../models/LearningContent');
const studySessionPath = require.resolve('../models/StudySession');
const contentServicePath = require.resolve('../services/contentService');
const contentRecommendationServicePath = require.resolve('../services/contentRecommendationService');
const presetServicePath = require.resolve('../services/presetService');

const originalModules = new Map();

const mockModule = (modulePath, exportsValue) => {
  if (!originalModules.has(modulePath)) {
    originalModules.set(modulePath, require.cache[modulePath]);
  }

  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue
  };
};

const restoreModules = () => {
  for (const [modulePath, cachedModule] of originalModules.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
    } else {
      delete require.cache[modulePath];
    }
  }

  originalModules.clear();
  delete require.cache[controllerPath];
};

test('dashboard overview still succeeds if content recommendations fail', async () => {
  mockModule(deckPath, {
    find() {
      return {
        sort() {
          return {
            limit() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  });

  mockModule(flashcardPath, {
    countDocuments: async () => 0,
    aggregate: async () => []
  });

  mockModule(learningContentPath, {
    find() {
      return {
        sort() {
          return {
            limit() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  });

  mockModule(studySessionPath, {
    find() {
      return {
        populate() {
          return {
            sort() {
              return {
                limit() {
                  return Promise.resolve([]);
                }
              };
            }
          };
        },
        select() {
          return Promise.resolve([]);
        }
      };
    }
  });

  mockModule(contentServicePath, {
    serializeContent: (item) => item,
    CONTENT_VISIBILITY: {
      COMMUNITY: 'community',
      GLOBAL: 'global'
    }
  });

  mockModule(contentRecommendationServicePath, {
    getRecommendedContent: async () => {
      throw new Error('recommendation failure');
    }
  });

  mockModule(presetServicePath, {
    getRecommendedPresets: async () => []
  });

  const { getDashboardOverview } = require('../controllers/dashboardController');

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await getDashboardOverview(
    {
      user: {
        _id: 'user-1',
        language: 'Japanese',
        dailyGoal: 10
      }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.recommendedContent, []);

  restoreModules();
});
