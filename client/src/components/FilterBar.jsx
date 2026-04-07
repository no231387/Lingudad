function FilterBar({ filters, onChange, onReset }) {
  return (
    <section className="card filter-panel">
      <div className="section-header">
        <div>
          <h3>Filter Flashcards</h3>
          <p className="muted-text">Narrow your card list by language, deck category, or proficiency level.</p>
        </div>
      </div>

      <div className="filter-grid">
        <label>
          Search
          <input
            name="search"
            value={filters.search}
            onChange={onChange}
            placeholder="Search word, translation, language, or example"
          />
        </label>

        <label>
          Language
          <input name="language" value={filters.language} onChange={onChange} placeholder="e.g., Spanish" />
        </label>

        <label>
          Category
          <input name="category" value={filters.category} onChange={onChange} placeholder="e.g., Food" />
        </label>

        <label>
          Proficiency
          <select name="proficiency" value={filters.proficiency} onChange={onChange}>
            <option value="">All</option>
            <option value="1">1 - New</option>
            <option value="2">2 - Learning</option>
            <option value="3">3 - Familiar</option>
            <option value="4">4 - Strong</option>
            <option value="5">5 - Mastered</option>
          </select>
        </label>
      </div>

      <div className="action-row">
        <button type="button" onClick={onReset} className="secondary-button">
          Reset Filters
        </button>
      </div>
    </section>
  );
}

export default FilterBar;
