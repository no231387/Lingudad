export const IMPORT_FIELD_CONFIG = [
  {
    key: 'question',
    label: 'Word / Phrase',
    required: true,
    aliases: ['question', 'word', 'wordphrase', 'wordorphrase', 'phrase', 'front', 'term']
  },
  {
    key: 'answer',
    label: 'Translation',
    required: true,
    aliases: ['answer', 'translation', 'back', 'meaning']
  },
  {
    key: 'proficiency',
    label: 'Learning Level',
    required: false,
    aliases: ['proficiency', 'level', 'learninglevel', 'proficiencylevel', 'proficiencylevel15']
  },
  {
    key: 'deck',
    label: 'Deck (Optional)',
    required: false,
    aliases: ['deck', 'category', 'topic']
  },
  {
    key: 'language',
    label: 'Language',
    required: false,
    aliases: ['language', 'lang']
  }
];

const normalizeCell = (value) => String(value ?? '').trim();
const normalizeHeader = (value) => normalizeCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');

export const createEmptyMapping = () =>
  IMPORT_FIELD_CONFIG.reduce((mapping, field) => {
    mapping[field.key] = '';
    return mapping;
  }, {});

const parsePreviewProficiency = (value) => {
  const normalizedValue = normalizeCell(value).toLowerCase();

  if (!normalizedValue) {
    return { value: '' };
  }

  const labelMap = {
    new: 1,
    beginner: 1,
    learning: 2,
    familiar: 3,
    intermediate: 3,
    strong: 4,
    advanced: 4,
    mastered: 5,
    expert: 5
  };

  if (labelMap[normalizedValue]) {
    return { value: String(labelMap[normalizedValue]) };
  }

  const directNumber = Number(normalizedValue);

  if (Number.isInteger(directNumber) && directNumber >= 1 && directNumber <= 5) {
    return { value: String(directNumber) };
  }

  const embeddedDigitMatch = normalizedValue.match(/[1-5]/);

  if (embeddedDigitMatch) {
    return { value: embeddedDigitMatch[0] };
  }

  return { error: 'Learning Level must map to a level from 1 to 5.' };
};

const splitDelimitedLine = (line, delimiter) => {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.replace(/\r/g, '').trim());
};

const detectDelimiter = (text, format = 'auto') => {
  if (format === 'csv') return ',';
  if (format === 'tsv') return '\t';

  const lines = text.split(/\n/).filter((line) => line.trim() !== '').slice(0, 3);
  const tabCount = lines.reduce((count, line) => count + (line.match(/\t/g) || []).length, 0);
  const commaCount = lines.reduce((count, line) => count + (line.match(/,/g) || []).length, 0);

  return tabCount > commaCount ? '\t' : ',';
};

export const parseImportText = (text, options = {}) => {
  const trimmedText = String(text || '').trim();

  if (!trimmedText) {
    return {
      delimiter: ',',
      headers: [],
      rows: []
    };
  }

  const delimiter = detectDelimiter(trimmedText, options.format);
  const parsedLines = trimmedText
    .split(/\n/)
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => line.trim() !== '')
    .map((line) => splitDelimitedLine(line, delimiter));

  if (parsedLines.length === 0) {
    return {
      delimiter,
      headers: [],
      rows: []
    };
  }

  const hasHeaders = options.hasHeaders !== false;
  const firstRow = parsedLines[0];
  const headers = hasHeaders ? firstRow.map((value, index) => normalizeCell(value) || `Column ${index + 1}`) : firstRow.map((_, index) => `Column ${index + 1}`);
  const dataRows = hasHeaders ? parsedLines.slice(1) : parsedLines;

  return {
    delimiter,
    headers,
    rows: dataRows.map((cells, index) => ({
      rowNumber: index + 1,
      cells
    }))
  };
};

export const getAutoMapping = (headers) => {
  const mapping = createEmptyMapping();
  const autoMappedFields = [];

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);
    const matchingField = IMPORT_FIELD_CONFIG.find((field) => field.aliases.includes(normalizedHeader));

    if (matchingField && !mapping[matchingField.key]) {
      mapping[matchingField.key] = String(index);
      autoMappedFields.push(matchingField.key);
    }
  });

  return {
    mapping,
    autoMappedFields,
    missingRequiredFields: IMPORT_FIELD_CONFIG.filter((field) => field.required && mapping[field.key] === '').map((field) => field.key)
  };
};

export const validatePreviewRows = (rows, mapping) =>
  rows.map((row) => {
    const getValue = (field) => {
      const columnIndex = mapping[field];
      if (columnIndex === '') return '';
      return normalizeCell(row.cells[Number(columnIndex)]);
    };

    const cleanedRow = {
      rowNumber: row.rowNumber,
      question: getValue('question'),
      answer: getValue('answer'),
      proficiency: '',
      deck: getValue('deck'),
      language: getValue('language')
    };

    const errors = [];

    if (!cleanedRow.question) errors.push('Word / Phrase is required.');
    if (!cleanedRow.answer) errors.push('Translation is required.');

    const proficiencyResult = parsePreviewProficiency(getValue('proficiency'));

    if (proficiencyResult.error) {
      errors.push(proficiencyResult.error);
    }

    cleanedRow.proficiency = proficiencyResult.value || '';

    return {
      ...row,
      cleanedRow,
      errors,
      isValid: errors.length === 0
    };
  });

export const buildSampleCsv = () => `Word or Phrase,Translation,Proficiency Level (1-5),Deck,Language
Hola,Hello,1,Greetings,Spanish
Gracias,Thank you,2,Essentials,Spanish
`;
