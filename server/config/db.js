const mongoose = require('mongoose');

const removeLegacyLearningContentIndexes = async (connection) => {
  const collection = connection.db.collection('learningcontents');
  const legacyParallelArrayIndex = 'topicTags_1_registerTags_1_skillTags_1';

  try {
    const indexes = await collection.indexes();
    const hasLegacyIndex = indexes.some((index) => index.name === legacyParallelArrayIndex);

    if (hasLegacyIndex) {
      await collection.dropIndex(legacyParallelArrayIndex);
      console.log(`Removed legacy learning content index: ${legacyParallelArrayIndex}`);
    }
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound') {
      throw error;
    }
  }
};

const removeLegacyVocabularyIndexes = async (connection) => {
  const collection = connection.db.collection('vocabularies');
  const legacyParallelArrayIndex = 'topicTags_1_registerTags_1_skillTags_1';

  try {
    const indexes = await collection.indexes();
    const hasLegacyIndex = indexes.some((index) => index.name === legacyParallelArrayIndex);

    if (hasLegacyIndex) {
      await collection.dropIndex(legacyParallelArrayIndex);
      console.log(`Removed legacy vocabulary index: ${legacyParallelArrayIndex}`);
    }
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound') {
      throw error;
    }
  }
};

const removeLegacySentenceIndexes = async (connection) => {
  const collection = connection.db.collection('sentences');
  const legacyParallelArrayIndex = 'difficulty_1_topicTags_1_registerTags_1_skillTags_1';

  try {
    const indexes = await collection.indexes();
    const hasLegacyIndex = indexes.some((index) => index.name === legacyParallelArrayIndex);

    if (hasLegacyIndex) {
      await collection.dropIndex(legacyParallelArrayIndex);
      console.log(`Removed legacy sentence index: ${legacyParallelArrayIndex}`);
    }
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound') {
      throw error;
    }
  }
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

    if (!mongoUri) {
      throw new Error('Missing MONGODB_URI or DATABASE_URL environment variable.');
    }

    const conn = await mongoose.connect(mongoUri);
    await removeLegacyLearningContentIndexes(conn.connection);
    await removeLegacyVocabularyIndexes(conn.connection);
    await removeLegacySentenceIndexes(conn.connection);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
