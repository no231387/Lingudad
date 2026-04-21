const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const LearningContent = require('../models/LearningContent');
const { STARTER_CONTENT_SEED_SOURCE } = require('../seed/starterContentData');

dotenv.config();

const buildRemovalFilter = () => ({
  $or: [
    { seedSource: STARTER_CONTENT_SEED_SOURCE },
    { 'metadata.seededBy': STARTER_CONTENT_SEED_SOURCE }
  ]
});

const removeStarterContent = async () => {
  try {
    await connectDB();

    const filter = buildRemovalFilter();
    const existingCount = await LearningContent.countDocuments(filter);
    const result = await LearningContent.deleteMany(filter);

    console.log(
      JSON.stringify(
        {
          seedSource: STARTER_CONTENT_SEED_SOURCE,
          matched: existingCount,
          removed: result.deletedCount || 0
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Starter content removal failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

removeStarterContent();
