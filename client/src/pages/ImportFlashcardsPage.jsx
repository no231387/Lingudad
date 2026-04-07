import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bulkImportFlashcards, getDecks } from '../services/flashcardService';
import {
  buildSampleCsv,
  createEmptyMapping,
  getAutoMapping,
  IMPORT_FIELD_CONFIG,
  parseImportText,
  validatePreviewRows
} from '../utils/importUtils';
import PageIntro from '../components/PageIntro';

const emptyParseResult = {
  delimiter: ',',
  headers: [],
  rows: []
};

function ImportFlashcardsPage() {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState('auto');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [mapping, setMapping] = useState(createEmptyMapping());
  const [parseResult, setParseResult] = useState(emptyParseResult);
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [deckImportMode, setDeckImportMode] = useState('from_import');
  const [availableDecks, setAvailableDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckName, setNewDeckName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [autoMappedFields, setAutoMappedFields] = useState([]);
  const [showMappingEditor, setShowMappingEditor] = useState(false);

  const previewRows = useMemo(() => validatePreviewRows(parseResult.rows, mapping), [parseResult.rows, mapping]);
  const validRows = useMemo(() => previewRows.filter((row) => row.isValid).map((row) => row.cleanedRow), [previewRows]);
  const cleanedRows = useMemo(() => previewRows.map((row) => row.cleanedRow), [previewRows]);
  const importedDeckNames = useMemo(
    () => {
      if (deckImportMode === 'existing_deck') {
        const selectedDeck = availableDecks.find((deck) => deck._id === selectedDeckId);
        return selectedDeck ? [selectedDeck.name] : [];
      }

      if (deckImportMode === 'new_deck' && newDeckName.trim()) {
        return [newDeckName.trim()];
      }

      return [...new Set(validRows.map((row) => row.deck).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    },
    [availableDecks, deckImportMode, newDeckName, selectedDeckId, validRows]
  );
  const missingRequiredFields = IMPORT_FIELD_CONFIG.filter((field) => field.required && mapping[field.key] === '');
  const requiredFieldsMapped = missingRequiredFields.length === 0;
  const shouldShowMappingEditor = parseResult.headers.length > 0 && (showMappingEditor || !requiredFieldsMapped);
  const autoMappedRequiredFields = IMPORT_FIELD_CONFIG.filter((field) => field.required).every((field) => autoMappedFields.includes(field.key));
  const deckSelectionIsValid =
    deckImportMode === 'from_import' ||
    (deckImportMode === 'existing_deck' && selectedDeckId) ||
    (deckImportMode === 'new_deck' && newDeckName.trim());
  const selectedExistingDeck = availableDecks.find((deck) => deck._id === selectedDeckId) || null;

  useEffect(() => {
    const loadDecks = async () => {
      try {
        const { data } = await getDecks();
        setAvailableDecks(data);
      } catch (error) {
        console.error('Failed to load decks for import:', error);
      }
    };

    loadDecks();
  }, []);

  const applyAutoMapping = (headers) => {
    const autoMappingResult = getAutoMapping(headers);
    setMapping(autoMappingResult.mapping);
    setAutoMappedFields(autoMappingResult.autoMappedFields);
    setShowMappingEditor(autoMappingResult.missingRequiredFields.length > 0);
  };

  const handleParse = () => {
    const nextParseResult = parseImportText(rawText, { format, hasHeaders });
    setParseResult(nextParseResult);
    applyAutoMapping(nextParseResult.headers);
    setImportSummary(null);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileText = await file.text();
    setRawText(fileText);
    setFileName(file.name);
    setImportSummary(null);
  };

  const handleMappingChange = (event) => {
    const { name, value } = event.target;
    setMapping((previous) => ({
      ...previous,
      [name]: value
    }));
    setShowMappingEditor(true);
  };

  const handleResetMapping = () => {
    setMapping(createEmptyMapping());
    setAutoMappedFields([]);
    setShowMappingEditor(true);
  };

  const handleAutoMapAgain = () => {
    applyAutoMapping(parseResult.headers);
  };

  const handleDeckImportModeChange = (event) => {
    const nextMode = event.target.value;
    setDeckImportMode(nextMode);

    if (nextMode !== 'existing_deck') {
      setSelectedDeckId('');
    }

    if (nextMode !== 'new_deck') {
      setNewDeckName('');
    }
  };

  const handleImport = async () => {
    if (!requiredFieldsMapped || !deckSelectionIsValid || validRows.length === 0 || isImporting) return;

    try {
      setIsImporting(true);
      const { data } = await bulkImportFlashcards({
        rows: cleanedRows,
        duplicateHandling,
        targetDeckId: deckImportMode === 'existing_deck' ? selectedDeckId : '',
        targetDeckName: deckImportMode === 'new_deck' ? newDeckName.trim() : ''
      });
      setImportSummary(data);
    } catch (error) {
      console.error('Failed to import flashcards:', error);
      alert('Import failed. Please review your data and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([buildSampleCsv()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'linguacards-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalInvalidRows = previewRows.length - validRows.length;

  return (
    <section className="page-section import-page">
      <PageIntro
        eyebrow="Import"
        title="Bring in flashcards with confidence"
        description="Upload or paste structured data, preview the mapping, and import cards into the right deck without guessing what will happen."
      />

      <div className="card form-card form-shell">
        <label>
          Upload CSV or TXT File
          <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={handleFileUpload} />
        </label>

        {fileName && <p className="muted-text">Selected file: {fileName}</p>}

        <label>
          Paste CSV or Tab-Separated Text
          <textarea
            rows="10"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Word or Phrase,Translation,Proficiency Level (1-5),Deck,Language"
          />
        </label>

        <div className="filter-grid">
          <label>
            Format
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="auto">Auto Detect</option>
              <option value="csv">CSV</option>
              <option value="tsv">Tab Separated</option>
            </select>
          </label>

          <label className="checkbox-label">
            <span>First Row Contains Headers</span>
            <input type="checkbox" checked={hasHeaders} onChange={(event) => setHasHeaders(event.target.checked)} />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={handleParse}>
            Preview Import
          </button>
          <button type="button" onClick={downloadSample} className="secondary-button">
            Download Sample CSV
          </button>
        </div>
      </div>

      {parseResult.headers.length > 0 && (
        <div className="card">
          <div className="mapping-header">
            <div>
              <h3>Column Mapping</h3>
              {autoMappedFields.length > 0 && (
                <p className="success-text">
                  Columns automatically mapped based on headers
                  {autoMappedRequiredFields ? '.' : ', but a few fields still need review.'}
                </p>
              )}
              {missingRequiredFields.length > 0 && (
                <p className="warning-text">
                  Required fields still missing:
                  {' '}
                  {missingRequiredFields.map((field) => field.label).join(', ')}
                </p>
              )}
            </div>

            <div className="action-row">
              <button type="button" onClick={handleResetMapping} className="secondary-button">
                Reset Mapping
              </button>
              <button type="button" onClick={handleAutoMapAgain} className="secondary-button">
                Auto-Map Again
              </button>
              {requiredFieldsMapped && !showMappingEditor && (
                <button type="button" onClick={() => setShowMappingEditor(true)} className="secondary-button">
                  Review Mapping
                </button>
              )}
            </div>
          </div>

          {shouldShowMappingEditor && (
            <div className="mapping-list">
              {IMPORT_FIELD_CONFIG.map((field) => {
                const isMapped = mapping[field.key] !== '';
                const isAutoMapped = autoMappedFields.includes(field.key);

                return (
                  <div key={field.key} className={`mapping-row ${field.required ? 'mapping-required' : ''}`}>
                    <div className="mapping-label-group">
                      <span className="mapping-label">{field.label}</span>
                      {field.required && <span className="mapping-required-badge">Required</span>}
                    </div>

                    <span className={`mapping-status ${isMapped ? 'mapping-ok' : 'mapping-warning'}`}>
                      {isMapped ? (isAutoMapped ? 'Auto-Mapped' : 'Mapped') : field.required ? 'Needs Mapping' : 'Optional'}
                    </span>

                    <select name={field.key} value={mapping[field.key]} onChange={handleMappingChange}>
                      <option value="">Do not import</option>
                      {parseResult.headers.map((header, index) => (
                        <option key={`${field.key}-${header}-${index}`} value={String(index)}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="card">
          <h3>Preview</h3>
          <p>
            Showing mapped columns only.
            {' '}
            {validRows.length} valid card(s) ready to import.
            {' '}
            {totalInvalidRows} invalid card(s) will be skipped.
          </p>

          {!requiredFieldsMapped && <p className="warning-text">Map Word / Phrase and Translation before importing.</p>}

          <div className="mapped-column-tags">
            {IMPORT_FIELD_CONFIG.filter((field) => mapping[field.key] !== '').map((field) => (
              <span key={field.key} className="mapped-column-tag">
                {field.label}
              </span>
            ))}
          </div>

          <label>
            Duplicate Handling
            <select value={duplicateHandling} onChange={(event) => setDuplicateHandling(event.target.value)}>
              <option value="skip">Skip duplicates</option>
              <option value="import_anyway">Import anyway</option>
              <option value="update_existing">Update existing</option>
            </select>
          </label>

          <div className="subsurface-panel">
            <h4>Choose Where Imported Cards Go</h4>
            <div className="selection-list">
              <label className="selection-row">
                <input type="radio" name="deckImportMode" value="from_import" checked={deckImportMode === 'from_import'} onChange={handleDeckImportModeChange} />
                <span>Use the deck names from the imported file</span>
              </label>
              <label className="selection-row">
                <input type="radio" name="deckImportMode" value="existing_deck" checked={deckImportMode === 'existing_deck'} onChange={handleDeckImportModeChange} />
                <span>Add all imported cards to one existing deck</span>
              </label>
              <label className="selection-row">
                <input type="radio" name="deckImportMode" value="new_deck" checked={deckImportMode === 'new_deck'} onChange={handleDeckImportModeChange} />
                <span>Create one new deck for all imported cards</span>
              </label>
            </div>

            {deckImportMode === 'existing_deck' && (
              <label>
                Existing Deck
                <select value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)}>
                  <option value="">Select a deck</option>
                  {availableDecks.map((deck) => (
                    <option key={deck._id} value={deck._id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {deckImportMode === 'new_deck' && (
              <label>
                New Deck Name
                <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} placeholder="e.g., Travel Vocabulary" />
              </label>
            )}

            {!deckSelectionIsValid && <p className="warning-text">Choose a deck before importing.</p>}
          </div>

          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Card #</th>
                  <th className={mapping.question !== '' ? 'active-preview-column' : ''}>Word / Phrase</th>
                  <th className={mapping.answer !== '' ? 'active-preview-column' : ''}>Translation</th>
                  <th className={mapping.deck !== '' ? 'active-preview-column' : ''}>Deck (Optional)</th>
                  <th className={mapping.language !== '' ? 'active-preview-column' : ''}>Language</th>
                  <th className={mapping.proficiency !== '' ? 'active-preview-column' : ''}>Learning Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className={row.isValid ? '' : 'invalid-row'}>
                    <td>{row.rowNumber}</td>
                    <td>{row.cleanedRow.question || '-'}</td>
                    <td>{row.cleanedRow.answer || '-'}</td>
                    <td>
                      {deckImportMode === 'existing_deck'
                        ? selectedExistingDeck?.name || '-'
                        : deckImportMode === 'new_deck'
                          ? newDeckName.trim() || '-'
                          : row.cleanedRow.deck || '-'}
                    </td>
                    <td>{row.cleanedRow.language || '-'}</td>
                    <td>{row.cleanedRow.proficiency || '-'}</td>
                    <td>{row.isValid ? 'Ready' : row.errors.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="action-row">
            <button type="button" onClick={handleImport} disabled={!requiredFieldsMapped || !deckSelectionIsValid || validRows.length === 0 || isImporting}>
              {isImporting ? 'Importing...' : `Import ${validRows.length} Valid Card(s)`}
            </button>
          </div>
        </div>
      )}

      {importSummary && (
        <div className="card">
          <h3>Import Summary</h3>
          {importSummary.insertedRows > 0 && (
            <div className="success-panel">
              <p className="success-text">Import successful. Your flashcards were added to your deck collection.</p>
              {importedDeckNames.length > 0 && (
                <div className="mapped-column-tags">
                  {importedDeckNames.map((deckName) => (
                    <span key={deckName} className="mapped-column-tag">
                      {deckName}
                    </span>
                  ))}
                </div>
              )}
              <Link className="button-link" to="/decks">
                View My Decks
              </Link>
            </div>
          )}

          <div className="stats-grid">
            <article className="card">
              <h4>Total Rows</h4>
              <p className="stat-number">{importSummary.totalRows}</p>
            </article>
            <article className="card">
              <h4>Inserted Rows</h4>
              <p className="stat-number">{importSummary.insertedRows}</p>
            </article>
            <article className="card">
              <h4>Invalid Rows</h4>
              <p className="stat-number">{importSummary.invalidRows}</p>
            </article>
            <article className="card">
              <h4>Duplicate Rows</h4>
              <p className="stat-number">{importSummary.duplicateRows}</p>
            </article>
          </div>

          {importSummary.updatedRows > 0 && <p>Updated existing rows: {importSummary.updatedRows}</p>}
        </div>
      )}
    </section>
  );
}

export default ImportFlashcardsPage;
